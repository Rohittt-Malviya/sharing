/**
 * Centralised Express error-handling middleware.
 *
 * Must be registered *after* all routes so Express routes errors here.
 * Usage: app.use(errorHandler)
 */
const logger = require('../utils/logger');

/**
 * @param {Error & { statusCode?: number; code?: string }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  logger.error(`HTTP ${statusCode} on ${req.method} ${req.path}: ${message}`);

  res.status(statusCode).json({
    error: {
      message,
      code,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
