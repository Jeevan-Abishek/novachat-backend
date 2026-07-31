const User = require('../models/User');
const Chat = require('../models/Chat');

/**
 * Presence is tracked per-user (not per-socket) since a user may have
 * multiple tabs/devices connected across different server instances.
 * A Redis-backed counter would be more robust in production; this
 * simplified version assumes one active connection is enough signal
 * to flip status, with the DB as the source of truth for `lastSeenAt`.
 */
function registerPresenceHandlers(io, socket) {
  markOnline(io, socket.userId);

  socket.on('presence:update', async ({ status }) => {
    await User.findByIdAndUpdate(socket.userId, { status });
    broadcastToContacts(io, socket.userId, 'presence:changed', { userId: socket.userId, status });
  });

  socket.on('disconnect', async () => {
    await User.findByIdAndUpdate(socket.userId, { status: 'offline', lastSeenAt: new Date() });
    broadcastToContacts(io, socket.userId, 'presence:changed', {
      userId: socket.userId,
      status: 'offline',
      lastSeenAt: new Date(),
    });
  });
}

async function markOnline(io, userId) {
  await User.findByIdAndUpdate(userId, { status: 'online' });
  broadcastToContacts(io, userId, 'presence:changed', { userId, status: 'online' });
}

// Emits to every chat room the user belongs to, so only relevant
// contacts receive the presence update rather than a global broadcast.
async function broadcastToContacts(io, userId, event, payload) {
  const chats = await Chat.find({ 'members.user': userId }).select('_id');
  for (const chat of chats) {
    io.to(`chat:${chat._id}`).emit(event, payload);
  }
}

module.exports = registerPresenceHandlers;
