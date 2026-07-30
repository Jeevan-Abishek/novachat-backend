const Chat = require('../models/Chat');

function registerChatHandlers(io, socket) {
  // Join every chat room the user belongs to on connect so message:new events reach them.
  Chat.find({ 'members.user': socket.userId })
    .select('_id')
    .then((chats) => chats.forEach((c) => socket.join(`chat:${c._id}`)))
    .catch(() => {});

  socket.on('chat:join', async ({ chatId }) => {
    const chat = await Chat.findById(chatId);
    if (chat?.members.some((m) => m.user.toString() === socket.userId)) {
      socket.join(`chat:${chatId}`);
    }
  });

  socket.on('chat:leave', ({ chatId }) => socket.leave(`chat:${chatId}`));

  // Typing indicators — deliberately NOT persisted, purely ephemeral broadcast.
  socket.on('typing:start', ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId: socket.userId });
  });

  socket.on('typing:stop', ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId: socket.userId });
  });

  // Message read/delivered acknowledgements, fanned out to the sender's other clients.
  socket.on('message:delivered', ({ chatId, messageId }) => {
    socket.to(`chat:${chatId}`).emit('message:delivered', { messageId, userId: socket.userId });
  });

  socket.on('message:read', ({ chatId, messageId }) => {
    socket.to(`chat:${chatId}`).emit('message:read', { messageId, userId: socket.userId });
  });

  // WebRTC signaling relay for voice/video calls + screen share.
  // The media itself is peer-to-peer; the server only relays the handshake.
  socket.on('call:offer', ({ chatId, targetUserId, sdp }) => {
    io.to(`chat:${chatId}`).emit('call:offer', { chatId, from: socket.userId, targetUserId, sdp });
  });

  socket.on('call:answer', ({ chatId, targetUserId, sdp }) => {
    io.to(`chat:${chatId}`).emit('call:answer', { chatId, from: socket.userId, targetUserId, sdp });
  });

  socket.on('call:ice-candidate', ({ chatId, targetUserId, candidate }) => {
    io.to(`chat:${chatId}`).emit('call:ice-candidate', { chatId, from: socket.userId, targetUserId, candidate });
  });

  socket.on('call:end', ({ chatId }) => {
    io.to(`chat:${chatId}`).emit('call:end', { chatId, from: socket.userId });
  });
}

module.exports = registerChatHandlers;
