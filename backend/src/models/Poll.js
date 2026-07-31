const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true }
);

const pollSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    options: [pollOptionSchema],
    allowMultiple: { type: Boolean, default: false },
    closesAt: { type: Date, default: null },
    closed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Poll', pollSchema);
