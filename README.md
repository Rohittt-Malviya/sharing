# ShareDrop – Peer-to-Peer File Sharing PWA

A production-ready Progressive Web App for secure, peer-to-peer file sharing using WebRTC, built with React + Vite (frontend) and Node.js + Express + Socket.io (backend).

---

## 🚀 Features

- **P2P file transfer** via WebRTC Data Channels (no files stored on server)
- **End-to-end encryption** using AES-GCM (Web Crypto API)
- **File integrity verification** via SHA-256 hashing
- **Real-time progress** – speed, percentage, and ETA
- **Auto WebRTC handshake** – receiver joins → connection starts automatically
- **QR code + shareable link + 6-char short code** for easy sharing
- **PWA** – installable, offline UI via Service Worker
- **Drag & drop** file selection
- Files up to **500 MB** with 64 KB chunked transfer

---

## 📦 Project Structure

```
root/
├── backend/          # Node.js + Express + Socket.io signaling server
│   ├── server.js
│   ├── utils/
│   │   └── roomManager.js
│   ├── .env.example
│   └── package.json
├── frontend/         # React + Vite + Tailwind CSS PWA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── SenderPage.jsx
│   │   │   └── ReceiverPage.jsx
│   │   ├── components/
│   │   │   └── TransferProgress.jsx
│   │   ├── hooks/
│   │   │   └── useWebRTC.js
│   │   └── utils/
│   │       ├── crypto.js
│   │       ├── fileUtils.js
│   │       └── socket.js
│   ├── public/
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   └── icon.svg
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

---

## 🔌 Socket Event Contract

| Event | Direction | Payload |
|---|---|---|
| `create-room` | Sender → Server | `{}` |
| `room-created` | Server → Sender | `{ roomId, shortCode }` |
| `join-room` | Receiver → Server | `{ roomId }` |
| `peer-joined` | Server → Sender | `{ roomId }` |
| `webrtc-offer` | Sender → Server → Receiver | `{ offer, roomId }` |
| `webrtc-answer` | Receiver → Server → Sender | `{ answer, roomId }` |
| `ice-candidate` | Both → Server → Other | `{ candidate, roomId }` |
| `peer-disconnected` | Server → Remaining | `{ message }` |
| `room-not-found` | Server → Receiver | `{ message }` |
| `room-full` | Server → Receiver | `{ message }` |
| `error` | Server → Requester | `{ message }` |

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 18

### Backend

```bash
cd backend
cp .env.example .env   # edit PORT and FRONTEND_URL if needed
npm install
npm start              # or: npm run dev (uses nodemon)
```

### Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_BACKEND_URL to your backend URL
npm install
npm run dev            # development server on http://localhost:5173
npm run build          # production build → dist/
```

---

## 🌐 Deployment

### Frontend → Vercel

1. Import repo into [vercel.com](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variable: `VITE_BACKEND_URL=https://your-backend.onrender.com`
4. Deploy

### Backend → Render / Railway

1. Create new Web Service, point to `backend/`
2. Start command: `node server.js`
3. Add environment variables:
   - `PORT=4000`
   - `FRONTEND_URL=https://your-frontend.vercel.app`
4. Deploy

---

## 🔐 Security

- AES-GCM 256-bit encryption with random IV per file
- File encryption key exchanged over the WebRTC Data Channel (P2P, not server)
- SHA-256 hash verification after decryption
- No file data touches the server
- Rooms auto-expire after 5 minutes
- Max 2 peers per room

---

## ⚡ Performance

- 64 KB chunks with backpressure handling (`bufferedamountlow`)
- Entire file encrypted in memory before chunking
- Progress updates on every chunk
- Works on 3G networks