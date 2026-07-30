const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createRedisClient } = require('../config/redis');
const { verifyAccessToken } = require('../utils/jwt');
const env = require('../config/env');
const logger = require('../utils/logger');

const registerChatHandlers = require('./chatHandlers');
const registerPresenceHandlers = require('./presenceHandlers');

let io = null;

async function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
    // Sticky sessions are configured at the Nginx layer (ip_hash / cookie-based),
    // required because polling fallback and the initial handshake must land on
    // the same instance. The Redis adapter below is what makes emits reach
    // sockets connected to *other* instances regardless of stickiness.
    transports: ['websocket', 'polling'],
  });

  const pubClient = createRedisClient('socketio-pub');
  const subClient = createRedisClient('socketio-sub');
  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));
  logger.info(`[${env.instanceId}] Socket.IO Redis adapter attached`);

  // Auth handshake middleware — every socket connection must present a valid JWT.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token missing'));
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      socket.username = payload.username;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[${env.instanceId}] Socket connected: ${socket.id} (user ${socket.userId})`);

    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`[${env.instanceId}] Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO server not initialized yet');
  return io;
}

module.exports = { initSocketServer, getIO };
