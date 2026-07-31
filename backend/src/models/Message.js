const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // Cloudinary secure_url
    publicId: { type: String, required: true },
    type: { type: String, enum: ['image', 'video', 'audio', 'file', 'sticker', 'gif'], required: true },
    name: String,
    size: Number,
    width: Number,
    height: Number,
    durationSeconds: Number,
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    content: { type: String, default: '' }, // markdown-capable text
    contentType: { type: String, enum: ['text', 'code', 'system'], default: 'text' },
    codeLanguage: { type: String, default: null }, // for syntax highlighting

    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinned: { type: Boolean, default: false },

    editedAt: { type: Date, default: null },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // soft delete per-user
    deletedForEveryone: { type: Boolean, default: false },

    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Supports infinite-scroll pagination ordered by recency within a chat.
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', messageSchema);
