# ⚡ Real-Time Checkbox Grid

A collaborative, real-time checkbox grid where multiple users can connect, interact, and see updates instantly. Built with modern real-time architecture and powered by Redis for shared state.

🌐 **Live Demo:**  
https://real-time-checkbox-grid-production.up.railway.app/

---

## 🚀 Features

- 🟢 Real-time updates across all connected users  
- 👥 Live user count tracking  
- 🔄 Instant sync using WebSockets  
- ⚡ Redis-backed shared state  
- 🔐 Simple username-based login system  
- 🎯 Smooth and responsive UI  

---

## 🖼️ Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/rishiwaghdev/Real-Time-Checkbox-Grid/main/asset/Screenshot.png" width="800"/>
</p>

---

## 🏗️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Node.js  
- **Real-time Communication:** WebSockets / Socket.IO  
- **Database / Cache:** Redis (Upstash / Railway)  
- **Deployment:** Railway  

---

## 📦 Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/rishiwaghdev/real-time-checkbox-grid.git
cd real-time-checkbox-grid
```

### 2. Install dependencies
```bash
pnpm install
# or
npm install
```

### 3. Setup environment variables

Create a `.env` file:

```env
REDIS_URL=https://funny-bulldog-77766.upstash.io
PORT=3000
```

### 4. Run the app
```bash
pnpm dev
# or
npm run dev
```

---

## 🌍 How It Works

- User enters a username and connects  
- A shared grid is loaded from Redis  
- When a checkbox is toggled:
  - Update is sent to the server  
  - Server updates Redis  
  - Broadcasts change to all connected clients  
- All users see changes instantly ⚡  

---

## 📁 Project Structure

```
├── server/
│   ├── index.js
│   └── redis.js
├── client/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── .env
├── package.json
└── README.md
```

---

## 🔥 Future Improvements

- ✅ Authentication system (JWT / OAuth)  
- 🎨 Custom grid sizes  
- 📊 Activity logs / history  
- 🧑‍🤝‍🧑 User presence indicators  
- 🟦 Color-coded users  

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo  
2. Create your feature branch  
3. Commit your changes  
4. Push and open a PR  

---

## 📄 License

This project is licensed under the MIT License.

---

## 💡 Inspiration

Built to explore real-time systems, WebSockets, and distributed state management using Redis.
