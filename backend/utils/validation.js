/**
 * Canonical re-export of the input-validation helpers.
 *
 * Both `validation` and `validators` paths are supported so that code can
 * use whichever name feels more natural without the underlying helpers being
 * duplicated.  The implementation lives in `validators.js`.
 */
module.exports = require('./validators');
