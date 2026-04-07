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
const isDev = process.env.NODE_ENV !== 'production';

// FRONTEND_URL may contain a comma-separated list of allowed origins so that
// multiple deployments (e.g. local dev + staging + production) can be
// supported without changing code.  Example:
//   FRONTEND_URL=https://sharing-hhhe.onrender.com,http://localhost:5173
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = rawFrontendUrl.split(',').map((origin) => origin.trim()).filter(Boolean);

// Warn in production when FRONTEND_URL is still the localhost default — this
// causes every deployed frontend to be rejected by CORS.
if (!isDev && allowedOrigins.length === 1 && allowedOrigins[0] === 'http://localhost:5173') {
  console.error(
    '[Server] WARNING: FRONTEND_URL is not set or is still localhost. ' +
    'CORS will only allow http://localhost:5173. ' +
    'Set FRONTEND_URL to your deployed frontend origin(s), e.g.:\n' +
    '  FRONTEND_URL=https://your-app.example.com\n' +
    '  FRONTEND_URL=https://your-app.example.com,http://localhost:5173'
  );
}

const app = express();
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'] }));
app.use(express.json());

// Security headers – applied to all HTTP responses
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Only send HSTS over HTTPS (irrelevant locally but important in production)
  if (!isDev) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8, // 100 MB (not used for file data, just signaling)
  transports: ['websocket', 'polling'],
});

registerSocketHandlers(io, roomManager);

server.listen(PORT, () => {
  if (isDev) {
    logger.info(`\n🚀 Server running on http://localhost:${PORT}`);
    logger.info(`   Accepting connections from: ${allowedOrigins.join(', ')}\n`);
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

