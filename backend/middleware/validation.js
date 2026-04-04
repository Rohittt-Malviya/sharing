/**
 * Express request-validation helpers.
 *
 * Use these as route-level middleware to reject bad requests early,
 * before they reach the controller logic.
 */

/**
 * Rejects requests whose body is missing or is not a plain object.
 *
 * @type {import('express').RequestHandler}
 */
function requireJsonBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: { message: 'Request body must be a JSON object.', code: 'INVALID_BODY' },
    });
  }
  next();
}

/**
 * Factory: require the listed field names to be present and non-empty strings.
 *
 * @param {...string} fields
 * @returns {import('express').RequestHandler}
 */
function requireFields(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body[field];
      if (typeof value !== 'string' || !value.trim()) {
        return res.status(400).json({
          error: {
            message: `Field '${field}' is required and must be a non-empty string.`,
            code: 'MISSING_FIELD',
          },
        });
      }
    }
    next();
  };
}

module.exports = { requireJsonBody, requireFields };
