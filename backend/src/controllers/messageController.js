const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { ApiError } = require('../middleware/errorHandler');
const { uploadBuffer } = require('../config/cloudinary');
const { getIO } = require('../sockets');

// GET /api/messages/:chatId?before=<messageId>&limit=30
// Cursor-based pagination (by _id / createdAt) powers infinite scroll
// without the performance cost of offset-based pagination at scale.
async function getHistory(req, res, next) {
  try {
    const { chatId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    const chat = await Chat.findById(chatId);
    if (!chat) throw new ApiError(404, 'Chat not found');
    if (!chat.members.some((m) => m.user.toString() === req.user.id)) {
      throw new ApiError(403, 'Not a member of this chat');
    }

    const query = { chat: chatId, deletedForEveryone: false, deletedFor: { $ne: req.user.id } };
    if (req.query.before) {
      const cursor = await Message.findById(req.query.before).select('createdAt');
      if (cursor) query.createdAt = { $lt: cursor.createdAt };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'displayName username avatarUrl')
      .populate('replyTo');

    res.json(messages.reverse());
  } catch (err) {
    next(err);
  }
}

// POST /api/messages/:chatId  { content, replyTo?, mentions? }
async function sendMessage(req, res, next) {
  try {
    const { chatId } = req.params;
    const { content = '', replyTo = null, mentions = [], contentType = 'text', codeLanguage = null } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) throw new ApiError(404, 'Chat not found');
    const membership = chat.members.find((m) => m.user.toString() === req.user.id);
    if (!membership) throw new ApiError(403, 'Not a member of this chat');
    if (chat.announcementsOnly && !['owner', 'admin'].includes(membership.role)) {
      throw new ApiError(403, 'Only admins can post in this announcements channel');
    }

    let attachments = [];
    if (req.files?.length) {
      attachments = await Promise.all(
        req.files.map(async (file) => {
          const kind = file.mimetype.startsWith('image')
            ? 'image'
            : file.mimetype.startsWith('video')
            ? 'video'
            : file.mimetype.startsWith('audio')
            ? 'audio'
            : 'file';

          const result = await uploadBuffer(file.buffer, { folder: `novachat/${kind}s` });
          return {
            url: result.secure_url,
            publicId: result.public_id,
            type: kind,
            name: file.originalname,
            size: file.size,
            width: result.width,
            height: result.height,
            durationSeconds: result.duration,
          };
        })
      );
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user.id,
      content,
      contentType,
      codeLanguage,
      attachments,
      mentions,
      replyTo,
      deliveredTo: [req.user.id],
    });

    chat.lastMessage = message._id;
    chat.lastActivityAt = new Date();
    await chat.save();

    const populated = await message.populate('sender', 'displayName username avatarUrl');

    // Broadcast via Socket.IO (fanned out to all instances through the Redis adapter).
    getIO().to(`chat:${chatId}`).emit('message:new', populated);

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/messages/:id  { content }
async function editMessage(req, res, next) {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) throw new ApiError(404, 'Message not found');
    if (message.sender.toString() !== req.user.id) throw new ApiError(403, 'Not your message');

    message.content = req.body.content;
    message.editedAt = new Date();
    await message.save();

    getIO().to(`chat:${message.chat}`).emit('message:edited', message);
    res.json(message);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/messages/:id?forEveryone=true
async function deleteMessage(req, res, next) {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) throw new ApiError(404, 'Message not found');

    const isOwner = message.sender.toString() === req.user.id;
    const forEveryone = req.query.forEveryone === 'true';

    if (forEveryone) {
      if (!isOwner) throw new ApiError(403, 'Only the sender can delete for everyone');
      message.deletedForEveryone = true;
      message.content = '';
      message.attachments = [];
    } else {
      message.deletedFor.addToSet(req.user.id);
    }
    await message.save();

    if (forEveryone) {
      getIO().to(`chat:${message.chat}`).emit('message:deleted', { id: message._id });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

// POST /api/messages/:id/react  { emoji }
async function toggleReaction(req, res, next) {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) throw new ApiError(404, 'Message not found');

    const existingIdx = message.reactions.findIndex(
      (r) => r.user.toString() === req.user.id && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      message.reactions.splice(existingIdx, 1);
    } else {
      message.reactions.push({ emoji, user: req.user.id });
    }
    await message.save();

    getIO().to(`chat:${message.chat}`).emit('message:reaction', {
      messageId: message._id,
      reactions: message.reactions,
    });
    res.json(message.reactions);
  } catch (err) {
    next(err);
  }
}

// POST /api/messages/:id/star
async function toggleStar(req, res, next) {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) throw new ApiError(404, 'Message not found');

    const idx = message.starredBy.findIndex((id) => id.toString() === req.user.id);
    if (idx >= 0) message.starredBy.splice(idx, 1);
    else message.starredBy.push(req.user.id);
    await message.save();

    res.json({ starred: idx < 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHistory,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  toggleStar,
};
