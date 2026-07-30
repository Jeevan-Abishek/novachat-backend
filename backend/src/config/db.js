const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

mongoose.set('strictQuery', true);

async function connectDB(retries = MAX_RETRIES) {
  try {
    await mongoose.connect(env.mongoUri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
      // readPreference 'secondaryPreferred' spreads reads across the
      // replica set for higher availability + throughput.
      readPreference: 'secondaryPreferred',
    });
    logger.info(`[${env.instanceId}] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    if (retries > 0) {
      logger.warn(`Retrying MongoDB connection in ${RETRY_DELAY_MS}ms... (${retries} left)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return connectDB(retries - 1);
    }
    throw err;
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected — attempting to reconnect');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = connectDB;
