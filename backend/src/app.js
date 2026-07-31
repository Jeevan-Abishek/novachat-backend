const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const xss = require('xss-clean');
const hpp = require('hpp');

const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const callRoutes = require('./routes/callRoutes');

const app = express();

// Trust the Nginx reverse proxy so req.ip / secure cookies work correctly.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(xss()); // strips script/event-handler payloads from req.body, req.query, req.params
app.use(hpp()); // guards against HTTP parameter pollution
app.use(apiLimiter);

// Health checks — used by Nginx/Docker/orchestrator to detect and drain unhealthy instances.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', instance: env.instanceId, uptime: process.uptime() });
});
app.get('/health/ready', async (_req, res) => {
  const mongoose = require('mongoose');
  const isDbUp = mongoose.connection.readyState === 1;
  res.status(isDbUp ? 200 : 503).json({ ready: isDbUp });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/calls', callRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
