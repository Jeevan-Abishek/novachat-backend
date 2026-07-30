const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const { initSocketServer } = require('./sockets');
const logger = require('./utils/logger');

async function main() {
  await connectDB();

  const server = http.createServer(app);
  await initSocketServer(server);

  server.listen(env.port, () => {
    logger.info(`[${env.instanceId}] NovaChat API listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Graceful shutdown: stop accepting new connections, let in-flight
  // requests/sockets drain, then exit — so Nginx health checks can
  // remove this instance from rotation cleanly during deploys.
  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});
