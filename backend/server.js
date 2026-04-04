require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const roomManager = require('./utils/roomManager');
const { registerSocketHandlers } = require('./socket/socketHandler');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';

// Warn in production when FRONTEND_URL is still the localhost default — this
// causes every deployed frontend to be rejected by CORS.
if (!isDev && FRONTEND_URL === 'http://localhost:5173') {
  console.error(
    '[Server] WARNING: FRONTEND_URL is not set. ' +
    'CORS will only allow http://localhost:5173. ' +
    'Set FRONTEND_URL to your deployed frontend origin (e.g. https://your-app.example.com).'
  );
}

const app = express();
app.use(cors({ origin: FRONTEND_URL, methods: ['GET', 'POST'] }));
app.use(express.json());

// Dev-only request logging middleware
if (isDev) {
  app.use((req, _res, next) => {
    logger.debug(`[HTTP] ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Centralised error handler (must be after routes)
app.use(errorHandler);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8, // 100 MB (not used for file data, just signaling)
  transports: ['websocket', 'polling'],
});

registerSocketHandlers(io, roomManager);

server.listen(PORT, () => {
  if (isDev) {
    logger.info(`\n🚀 Server running on http://localhost:${PORT}`);
    logger.info(`   Accepting connections from: ${FRONTEND_URL}\n`);
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal) {
  logger.info(`[Server] ${signal} received — shutting down gracefully…`);
  server.close(() => {
    logger.info('[Server] HTTP server closed.');
    process.exit(0);
  });

  // Force exit if connections linger beyond 10 s
  setTimeout(() => {
    logger.error('[Server] Forced exit after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

