/**
 * Structured logger utility.
 *
 * - In development, logs are emitted with a timestamp prefix.
 * - In production, only info/warn/error are emitted (debug is suppressed).
 * - All output goes to stdout/stderr so it integrates naturally with
 *   process supervisors (PM2, Docker, etc.).
 */

const isDev = process.env.NODE_ENV !== 'production';

// Pre-computed label strings avoid toUpperCase() + padEnd() on every log call.
const LEVEL_LABELS = {
  info:  'INFO ',
  warn:  'WARN ',
  error: 'ERROR',
  debug: 'DEBUG',
};

/**
 * Format a log line.
 * @param {'info'|'warn'|'error'|'debug'} level
 * @param {string} message
 * @param {object|undefined} meta
 * @returns {string}
 */
function formatLine(level, message, meta) {
  const ts = new Date().toISOString();
  const label = LEVEL_LABELS[level] ?? level.toUpperCase().padEnd(5);
  const base = `[${ts}] [${label}] ${message}`;
  if (meta !== undefined) {
    const metaStr = typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
    return `${base} ${metaStr}`;
  }
  return base;
}

const logger = {
  /** Informational messages (always emitted). */
  info(message, meta) {
    console.log(formatLine('info', message, meta));
  },

  /** Warning messages (always emitted). */
  warn(message, meta) {
    console.warn(formatLine('warn', message, meta));
  },

  /** Error messages (always emitted). */
  error(message, meta) {
    console.error(formatLine('error', message, meta));
  },

  /** Debug messages (only emitted in development). */
  debug(message, meta) {
    if (isDev) {
      console.log(formatLine('debug', message, meta));
    }
  },
};

module.exports = logger;
