const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * In a multi-instance deployment behind Nginx, a plain in-memory limiter
 * only limits per-process. For production, pair this with a Redis store
 * (e.g. `rate-limit-redis`) so limits are shared across all Node instances.
 * The shape below is store-agnostic and can accept one via `options.store`.
 */
function createRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? env.rateLimit.windowMs,
    max: options.max ?? env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
    ...options,
  });
}

// Stricter limiter for auth endpoints to slow brute-force attempts.
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

// General API limiter.
const apiLimiter = createRateLimiter();

module.exports = { createRateLimiter, authLimiter, apiLimiter };
