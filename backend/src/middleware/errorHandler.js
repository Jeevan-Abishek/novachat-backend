const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error(`${err.message}\n${err.stack}`);
  } else {
    logger.warn(`${statusCode} ${err.message}`);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    details: err.details ?? undefined,
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
