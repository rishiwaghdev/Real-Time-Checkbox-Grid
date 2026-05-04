const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { Redis } = require('@upstash/redis');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const GRID_SIZE = GRID_WIDTH * GRID_HEIGHT;
const GRID_KEY = 'checkbox:grid:bits';
const CHANNEL = 'checkbox-grid:channel';
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

const inMemoryState = {
  bits: Array(GRID_SIZE).fill(0),
  rateKeys: new Map(),
  cooldownKeys: new Map()
};

if (!useRedis) {
  console.warn('Warning: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set. Using in-memory state only.');
}

const redis = useRedis ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : {
  getbit: async (key, index) => (inMemoryState.bits[index] || 0),
  setbit: async (key, index, value) => {
    inMemoryState.bits[index] = value ? 1 : 0;
    return 0;
  },
  lpush: async (key, value) => {
    const values = inMemoryState.rateKeys.get(key) || [];
    values.unshift(value);
    inMemoryState.rateKeys.set(key, values);
    return values.length;
  },
  ltrim: async (key, start, stop) => {
    const values = inMemoryState.rateKeys.get(key) || [];
    inMemoryState.rateKeys.set(key, values.slice(start, stop + 1));
    return 'OK';
  },
  expire: async (key, seconds) => {
    return 1;
  },
  lrange: async (key, start, stop) => {
    const values = inMemoryState.rateKeys.get(key) || [];
    return values.slice(start, stop + 1);
  },
  get: async (key) => {
    const payload = inMemoryState.cooldownKeys.get(key);
    if (!payload) return null;
    if (payload.expiresAt && payload.expiresAt <= Date.now()) {
      inMemoryState.cooldownKeys.delete(key);
      return null;
    }
    return payload.value;
  },
  ttl: async (key) => {
    const payload = inMemoryState.cooldownKeys.get(key);
    if (!payload || !payload.expiresAt) return -1;
    const ttl = Math.ceil((payload.expiresAt - Date.now()) / 1000);
    return ttl > 0 ? ttl : -1;
  },
  set: async (key, value) => {
    const expiresAt = Date.now() + 5000;
    inMemoryState.cooldownKeys.set(key, { value, expiresAt });
    return 'OK';
  }
};

const pub = useRedis ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : {
  publish: async (channel, message) => {
    broadcast(JSON.parse(message));
    return 1;
  }
};

const sub = useRedis ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function createToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
}

function validateUsername(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9-_]{3,20}$/.test(value);
}

async function getGridState() {
  const bits = [];
  for (let index = 0; index < GRID_SIZE; index += 1) {
    const value = await redis.getbit(GRID_KEY, index);
    bits.push(value ? 1 : 0);
  }
  return bits;
}

async function setGridBit(index, value) {
  return redis.setbit(GRID_KEY, index, value ? 1 : 0);
}

async function allowToggle(username) {
  const rateKey = `rate:${username}`;
  const cooldownKey = `cooldown:${username}`;
  const now = Date.now();

  const cooldown = await redis.get(cooldownKey);
  if (cooldown) {
    const ttl = await redis.ttl(cooldownKey);
    return { allowed: false, cooldown: true, retryAfter: Math.max(ttl, 1) };
  }

  await redis.lpush(rateKey, now.toString());
  await redis.ltrim(rateKey, 0, 3);
  await redis.expire(rateKey, 5);

  const entries = await redis.lrange(rateKey, 0, -1);
  if (entries.length >= 4) {
    const oldest = Number(entries[entries.length - 1]);
    if (now - oldest <= 2000) {
      await redis.set(cooldownKey, '1');
      await redis.expire(cooldownKey, 5);
      return { allowed: false, cooldown: true, retryAfter: 5 };
    }
  }

  return { allowed: true };
}

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, hyphen, or underscore.' });
  }

  const token = createToken(username);
  return res.json({ token, username });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', gridSize: GRID_SIZE });
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

async function handleToggle(socket, payload) {
  const { index, checked } = payload;
  const user = socket.user;

  if (typeof index !== 'number' || index < 0 || index >= GRID_SIZE) {
    return socket.send(JSON.stringify({ type: 'error', message: 'Invalid checkbox index.' }));
  }

  const rate = await allowToggle(user.username);
  if (!rate.allowed) {
    return socket.send(JSON.stringify({ type: 'cooldown', message: 'Too many rapid clicks. Please wait 5 seconds.', retryAfter: rate.retryAfter }));
  }

  await setGridBit(index, checked ? 1 : 0);
  const updatePayload = {
    type: 'update',
    index,
    checked: checked ? 1 : 0,
    username: user.username,
    timestamp: Date.now()
  };

  await pub.publish(CHANNEL, JSON.stringify(updatePayload));
  socket.send(JSON.stringify({ type: 'ack', message: 'Update saved.' }));
}

async function sendInitialState(socket) {
  const grid = await getGridState();
  socket.send(JSON.stringify({ type: 'init', username: socket.user.username, grid, connected: clients.size }));
}

wss.on('connection', async (socket, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    socket.close(1008, 'Missing authentication token.');
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.username) {
      throw new Error('Invalid token payload');
    }

    socket.user = { username: payload.username };
  } catch (error) {
    socket.close(1008, 'Invalid authentication token.');
    return;
  }

  clients.add(socket);
  await sendInitialState(socket);
  broadcast({ type: 'presence', connected: clients.size, username: socket.user.username });

  socket.on('message', async (message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (error) {
      return socket.send(JSON.stringify({ type: 'error', message: 'Malformed message payload.' }));
    }

    if (payload.type === 'toggle') {
      await handleToggle(socket, payload);
      return;
    }

    socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
  });

  socket.on('close', () => {
    clients.delete(socket);
    broadcast({ type: 'presence', connected: clients.size });
  });
});

if (useRedis && sub) {
  sub.subscribe(CHANNEL, (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (error) {
      console.error('Invalid pub/sub message', error);
      return;
    }
    broadcast(parsed);
  });
} else {
  console.log('Redis Pub/Sub disabled: broadcasting directly to connected clients only.');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
