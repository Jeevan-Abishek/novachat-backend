const crypto = require('crypto');
const Chat = require('../models/Chat');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/chats  — list current user's chats, most recently active first
async function listChats(req, res, next) {
  try {
    const chats = await Chat.find({ 'members.user': req.user.id })
      .sort({ lastActivityAt: -1 })
      .populate('members.user', 'displayName username avatarUrl status lastSeenAt')
      .populate('lastMessage');

    res.json(chats);
  } catch (err) {
    next(err);
  }
}

// POST /api/chats/direct  { userId }
async function createOrGetDirectChat(req, res, next) {
  try {
    const { userId } = req.body;
    if (userId === req.user.id) throw new ApiError(400, "Can't start a chat with yourself");

    let chat = await Chat.findOne({
      type: 'direct',
      'members.user': { $all: [req.user.id, userId] },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    });

    if (!chat) {
      chat = await Chat.create({
        type: 'direct',
        members: [{ user: req.user.id }, { user: userId }],
      });
    }

    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
}

// POST /api/chats/group  { name, memberIds[] }
async function createGroup(req, res, next) {
  try {
    const { name, memberIds = [] } = req.body;
    if (!name?.trim()) throw new ApiError(400, 'Group name is required');

    const members = [
      { user: req.user.id, role: 'owner' },
      ...memberIds.filter((id) => id !== req.user.id).map((id) => ({ user: id, role: 'member' })),
    ];

    const chat = await Chat.create({
      type: 'group',
      name: name.trim(),
      members,
      inviteLink: crypto.randomBytes(12).toString('hex'),
    });

    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
}

async function assertMembership(chatId, userId) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, 'Chat not found');
  const membership = chat.members.find((m) => m.user.toString() === userId);
  if (!membership) throw new ApiError(403, 'Not a member of this chat');
  return { chat, membership };
}

// PATCH /api/chats/:id/pin
async function togglePin(req, res, next) {
  try {
    const { chat } = await assertMembership(req.params.id, req.user.id);
    const isPinned = chat.pinnedBy.some((id) => id.toString() === req.user.id);

    if (isPinned) {
      chat.pinnedBy.pull(req.user.id);
    } else {
      chat.pinnedBy.push(req.user.id);
    }
    await chat.save();

    res.json({ pinned: !isPinned });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/chats/:id/archive
async function toggleArchive(req, res, next) {
  try {
    const { chat } = await assertMembership(req.params.id, req.user.id);
    const isArchived = chat.archivedBy.some((id) => id.toString() === req.user.id);

    if (isArchived) {
      chat.archivedBy.pull(req.user.id);
    } else {
      chat.archivedBy.push(req.user.id);
    }
    await chat.save();

    res.json({ archived: !isArchived });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/chats/:id/members/:memberId/role  { role }  — admin only
async function updateMemberRole(req, res, next) {
  try {
    const { chat, membership } = await assertMembership(req.params.id, req.user.id);
    if (!['owner', 'admin'].includes(membership.role)) {
      throw new ApiError(403, 'Only owners and admins can change roles');
    }

    const target = chat.members.find((m) => m.user.toString() === req.params.memberId);
    if (!target) throw new ApiError(404, 'Member not found in this chat');

    target.role = req.body.role;
    await chat.save();

    res.json(chat);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listChats,
  createOrGetDirectChat,
  createGroup,
  togglePin,
  toggleArchive,
  updateMemberRole,
};
