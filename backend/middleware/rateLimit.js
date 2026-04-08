/**
 * Simple in-process rate-limiting middleware.
 *
 * Counts requests per IP address within a sliding window and rejects requests
 * that exceed the configured limit with a 429 Too Many Requests response.
 *
 * Designed to be lightweight: no external dependencies, no Redis required.
 * For high-traffic production setups, replace with `express-rate-limit` backed
 * by a shared store (e.g. Redis) if you run multiple server instances.
 *
 * Usage:
 *   const rateLimit = require('./middleware/rateLimit');
 *   app.use(rateLimit({ windowMs: 60_000, max: 100 }));
 *
 * @param {object}  [options]
 * @param {number}  [options.windowMs=60000]  - Window duration in milliseconds.
 * @param {number}  [options.max=100]         - Maximum requests per window per IP.
 * @param {string}  [options.message]         - Custom error message.
 * @returns {import('express').RequestHandler}
 */
function rateLimit({ windowMs = 60_000, max = 100, message } = {}) {
  // ip → { count: number, windowStart: number }
  const store = new Map();

  // Periodically evict stale entries to prevent unbounded memory growth.
  // The interval is unref'd so it does not keep the process alive on shutdown.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store.entries()) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(ip);
      }
    }
  }, windowMs).unref();

  return function rateLimitMiddleware(req, res, next) {
    const ip =
      req.ip ||
      req.socket.remoteAddress ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      'unknown';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now - entry.windowStart >= windowMs) {
      // New window
      store.set(ip, { count: 1, windowStart: now });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: {
          message: message || 'Too many requests — please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: retryAfter,
        },
      });
    }

    next();
  };
}

module.exports = rateLimit;
