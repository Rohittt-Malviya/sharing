/**
 * Security-headers middleware.
 *
 * Sets a baseline set of HTTP response headers to harden the application
 * against common web vulnerabilities (clickjacking, MIME sniffing, XSS, etc.).
 *
 * Usage:
 *   const securityHeaders = require('./middleware/helmet');
 *   app.use(securityHeaders(isDev));
 *
 * @param {boolean} isDev - When true, HSTS header is omitted (HTTP is fine locally).
 * @returns {import('express').RequestHandler}
 */
function securityHeaders(isDev) {
  return function (_req, res, next) {
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Deny framing to prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Legacy XSS filter (still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Control how much referrer information is sent
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict what resources the page can load.
    // Allows WebSocket connections (ws:/wss:) for Socket.IO and blob/data
    // URLs for in-browser file handling.
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "connect-src 'self' ws: wss:",
        "img-src 'self' data: blob:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );

    // Permissions-Policy: disable unused powerful features
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );

    // Only send HSTS over HTTPS — irrelevant locally but critical in production
    if (!isDev) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }

    next();
  };
}

module.exports = securityHeaders;
