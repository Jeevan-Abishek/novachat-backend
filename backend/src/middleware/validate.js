const { validationResult } = require('express-validator');
const { ApiError } = require('./errorHandler');

/**
 * Runs an array of express-validator chains, then throws a structured
 * 422 ApiError if any failed. Usage: router.post('/x', validators, validate, handler)
 */
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'Validation failed', details));
}

module.exports = validate;
