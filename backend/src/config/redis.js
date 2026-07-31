const { createClient } = require('redis');
const env = require('./env');
const logger = require('../utils/logger');

/**
 * Creates a fresh Redis client. Socket.IO's Redis adapter requires two
 * dedicated connections (pub + sub) in addition to any client used for
 * general caching, so this factory is called multiple times.
 */
function createRedisClient(label = 'redis') {
  const client = createClient({
    socket: {
      host: env.redis.host,
      port: env.redis.port,
      reconnectStrategy: (attempts) => Math.min(attempts * 100, 3000),
    },
    password: env.redis.password,
  });

  client.on('error', (err) => logger.error(`[${label}] Redis error: ${err.message}`));
  client.on('connect', () => logger.info(`[${label}] Redis connecting...`));
  client.on('ready', () => logger.info(`[${label}] Redis ready`));
  client.on('reconnecting', () => logger.warn(`[${label}] Redis reconnecting...`));

  return client;
}

module.exports = { createRedisClient };
