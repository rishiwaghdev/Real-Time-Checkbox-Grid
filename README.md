# Real-Time Checkbox Grid

A shared checkbox grid with real-time updates across users.

## Features
- WebSocket-based real-time sync
- Redis-backed bit storage for efficient checkbox state
- Redis Pub/Sub broadcasting
- JWT login authentication
- Custom rate limiting with 5-second cooldown
- Toast notifications and connected user badge

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Realtime: `ws`
- Redis: Upstash via `@upstash/redis`
- Auth: JWT

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   copy .env.example .env
   ```

3. Fill in your Upstash Redis URL and token in `.env`.

4. Start the server:
   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in the browser.

## Environment Variables
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis auth token
- `JWT_SECRET` - JWT secret for token signing
- `PORT` - optional server port

## Usage
- Click **Login / Connect** and enter a username.
- The grid will load the current shared state.
- Toggling a checkbox updates Redis and broadcasts to all connected users.
- Rapid clicking is limited to 4 toggles in 2 seconds, then a 5-second cooldown is enforced.
