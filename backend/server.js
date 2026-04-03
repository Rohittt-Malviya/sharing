require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const roomManager = require('./utils/roomManager');
const { registerSocketHandlers } = require('./socket/socketHandler');

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: FRONTEND_URL, methods: ['GET', 'POST'] }));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8, // 100 MB (not used for file data, just signaling)
});

registerSocketHandlers(io, roomManager);

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Accepting connections from: ${FRONTEND_URL}\n`);
});
