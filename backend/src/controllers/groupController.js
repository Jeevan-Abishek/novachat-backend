const Chat = require('../models/Chat');
const Poll = require('../models/Poll');
const { ApiError } = require('../middleware/errorHandler');
const { getIO } = require('../sockets');

async function requireRole(chatId, userId, roles) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, 'Group not found');
  const membership = chat.members.find((m) => m.user.toString() === userId);
  if (!membership) throw new ApiError(403, 'Not a member');
  if (roles && !roles.includes(membership.role)) throw new ApiError(403, 'Insufficient permissions');
  return chat;
}

// POST /api/groups/:id/invite/regenerate
async function regenerateInvite(req, res, next) {
  try {
    const crypto = require('crypto');
    const chat = await requireRole(req.params.id, req.user.id, ['owner', 'admin']);
    chat.inviteLink = crypto.randomBytes(12).toString('hex');
    await chat.save();
    res.json({ inviteLink: chat.inviteLink });
  } catch (err) {
    next(err);
  }
}

// POST /api/groups/join/:inviteLink
async function joinByInvite(req, res, next) {
  try {
    const chat = await Chat.findOne({ inviteLink: req.params.inviteLink });
    if (!chat) throw new ApiError(404, 'Invalid invite link');

    if (!chat.members.some((m) => m.user.toString() === req.user.id)) {
      chat.members.push({ user: req.user.id, role: 'member' });
      await chat.save();
    }
    res.json(chat);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/groups/:id/announcements-only  { enabled }
async function setAnnouncementsOnly(req, res, next) {
  try {
    const chat = await requireRole(req.params.id, req.user.id, ['owner', 'admin']);
    chat.announcementsOnly = !!req.body.enabled;
    await chat.save();
    res.json(chat);
  } catch (err) {
    next(err);
  }
}

// POST /api/groups/:id/members/:memberId/remove
async function removeMember(req, res, next) {
  try {
    const chat = await requireRole(req.params.id, req.user.id, ['owner', 'admin', 'moderator']);
    chat.members = chat.members.filter((m) => m.user.toString() !== req.params.memberId);
    await chat.save();
    getIO().to(`chat:${chat._id}`).emit('group:memberRemoved', { chatId: chat._id, memberId: req.params.memberId });
    res.json(chat);
  } catch (err) {
    next(err);
  }
}

// POST /api/groups/:id/polls  { question, options[], allowMultiple, closesAt }
async function createPoll(req, res, next) {
  try {
    await requireRole(req.params.id, req.user.id);
    const { question, options, allowMultiple = false, closesAt = null } = req.body;

    const poll = await Poll.create({
      chat: req.params.id,
      createdBy: req.user.id,
      question,
      options: options.map((text) => ({ text, votes: [] })),
      allowMultiple,
      closesAt,
    });

    getIO().to(`chat:${req.params.id}`).emit('poll:created', poll);
    res.status(201).json(poll);
  } catch (err) {
    next(err);
  }
}

// POST /api/groups/polls/:pollId/vote  { optionId }
async function voteOnPoll(req, res, next) {
  try {
    const poll = await Poll.findById(req.params.pollId);
    if (!poll) throw new ApiError(404, 'Poll not found');
    if (poll.closed) throw new ApiError(400, 'Poll is closed');

    if (!poll.allowMultiple) {
      poll.options.forEach((opt) => opt.votes.pull(req.user.id));
    }
    const option = poll.options.id(req.body.optionId);
    if (!option) throw new ApiError(404, 'Option not found');

    if (option.votes.some((id) => id.toString() === req.user.id)) {
      option.votes.pull(req.user.id);
    } else {
      option.votes.push(req.user.id);
    }
    await poll.save();

    getIO().to(`chat:${poll.chat}`).emit('poll:updated', poll);
    res.json(poll);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  regenerateInvite,
  joinByInvite,
  setAnnouncementsOnly,
  removeMember,
  createPoll,
  voteOnPoll,
};
