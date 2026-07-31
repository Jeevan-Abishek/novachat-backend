const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group', 'community'], required: true, default: 'direct' },
    name: { type: String, trim: true }, // group/community name
    avatarUrl: { type: String, default: null },

    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['owner', 'admin', 'moderator', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        mutedUntil: { type: Date, default: null },
      },
    ],

    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastActivityAt: { type: Date, default: Date.now, index: true },

    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    inviteLink: { type: String, default: null },
    announcementsOnly: { type: Boolean, default: false }, // only admins can post

    isEncrypted: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chatSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('Chat', chatSchema);
