/**
 * HTTP routes – all Express route handlers live here.
 *
 * Keeping routes out of server.js means the entry-point stays focused on
 * infrastructure (middleware wiring, Socket.IO, graceful shutdown) and new
 * endpoints can be added without touching server.js.
 */

const express = require('express');

const router = express.Router();

// Health check – used by load balancers, uptime monitors, and CI tests
router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

module.exports = router;
