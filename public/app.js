const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const GRID_SIZE = GRID_WIDTH * GRID_HEIGHT;

const loginButton = document.getElementById('loginButton');
const loginOverlay = document.getElementById('loginOverlay');
const closeLogin = document.getElementById('closeLogin');
const submitLogin = document.getElementById('submitLogin');
const usernameInput = document.getElementById('usernameInput');
const connectedBadge = document.getElementById('connectedBadge');
const userBadge = document.getElementById('userBadge');
const connectedCount = document.getElementById('connectedCount');
const gridContainer = document.getElementById('gridContainer');
const toast = document.getElementById('toast');

let socket = null;
let username = null;
let token = null;
let gridState = Array(GRID_SIZE).fill(0);

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function setConnectionState(connected) {
  connectedBadge.textContent = connected ? 'Connected' : 'Not connected';
  connectedBadge.classList.toggle('connected', connected);
}

function updateConnectedCount(count) {
  connectedCount.textContent = `Connected: ${count}`;
}

function updateUserBadge(name) {
  userBadge.textContent = `Connected as ${name}`;
  userBadge.classList.remove('hidden');
}

function renderGrid() {
  gridContainer.innerHTML = '';
  gridContainer.classList.remove('hidden');
  for (let index = 0; index < GRID_SIZE; index += 1) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = gridState[index] === 1;
    checkbox.dataset.index = index;
    checkbox.addEventListener('change', onCheckboxToggle);

    const cell = document.createElement('label');
    cell.className = 'cell';
    cell.appendChild(checkbox);
    gridContainer.appendChild(cell);
  }
}

function updateCheckbox(index, checked) {
  gridState[index] = checked ? 1 : 0;
  const cell = gridContainer.querySelector(`[data-index="${index}"]`);
  if (cell) {
    cell.checked = checked;
  }
}

function openLogin() {
  loginOverlay.classList.remove('hidden');
  usernameInput.value = '';
  usernameInput.focus();
}

function closeLoginOverlay() {
  loginOverlay.classList.add('hidden');
}

function onCheckboxToggle(event) {
  const checkbox = event.currentTarget;
  const index = Number(checkbox.dataset.index);
  const checked = checkbox.checked;

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showToast('Not connected yet.', 'error');
    checkbox.checked = !checked;
    return;
  }

  socket.send(JSON.stringify({ type: 'toggle', index, checked }));
}

async function loginUser(name) {
  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: name })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    username = data.username;
    token = data.token;
    updateUserBadge(username);
    closeLoginOverlay();
    connectSocket();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function connectSocket() {
  if (!token) {
    showToast('Missing login token.', 'error');
    return;
  }

  setConnectionState(false);
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${encodeURIComponent(token)}`);

  socket.addEventListener('open', () => {
    setConnectionState(true);
    showToast('Realtime grid connected!', 'success');
  });

  socket.addEventListener('message', (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (payload.type === 'init') {
      gridState = payload.grid;
      renderGrid();
      updateConnectedCount(payload.connected || 1);
      updateUserBadge(payload.username);
      return;
    }

    if (payload.type === 'update') {
      gridState[payload.index] = payload.checked ? 1 : 0;
      const checkbox = gridContainer.querySelector(`[data-index="${payload.index}"]`);
      if (checkbox) {
        checkbox.checked = !!payload.checked;
      }
      return;
    }

    if (payload.type === 'presence') {
      updateConnectedCount(payload.connected || 0);
      return;
    }

    if (payload.type === 'cooldown') {
      showToast(payload.message || 'Action blocked. Wait a moment.', 'error');
      return;
    }

    if (payload.type === 'error') {
      showToast(payload.message || 'Error from server.', 'error');
      return;
    }

    if (payload.type === 'ack') {
      showToast(payload.message, 'success');
      return;
    }
  });

  socket.addEventListener('close', () => {
    setConnectionState(false);
    updateConnectedCount(0);
    showToast('Realtime connection closed.', 'error');
  });

  socket.addEventListener('error', () => {
    setConnectionState(false);
    showToast('WebSocket error occurred.', 'error');
  });
}

loginButton.addEventListener('click', openLogin);
closeLogin.addEventListener('click', closeLoginOverlay);
submitLogin.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (!name) {
    showToast('Please enter a username.', 'error');
    return;
  }
  loginUser(name);
});

usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    submitLogin.click();
  }
});

setConnectionState(false);
updateConnectedCount(0);
