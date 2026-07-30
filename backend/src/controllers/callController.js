const CallLog = require('../models/CallLog');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/calls  { chatId, type }
async function startCall(req, res, next) {
  try {
    const { chatId, type } = req.body;
    const call = await CallLog.create({
      chat: chatId,
      initiatedBy: req.user.id,
      participants: [req.user.id],
      type,
      status: 'ongoing',
    });
    res.status(201).json(call);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/calls/:id/end  { status }
async function endCall(req, res, next) {
  try {
    const call = await CallLog.findById(req.params.id);
    if (!call) throw new ApiError(404, 'Call not found');

    call.status = req.body.status || 'completed';
    call.endedAt = new Date();
    call.durationSeconds = Math.round((call.endedAt - call.startedAt) / 1000);
    await call.save();

    res.json(call);
  } catch (err) {
    next(err);
  }
}

// GET /api/calls/:chatId/history
async function getCallHistory(req, res, next) {
  try {
    const calls = await CallLog.find({ chat: req.params.chatId })
      .sort({ startedAt: -1 })
      .limit(50)
      .populate('initiatedBy', 'displayName username avatarUrl');
    res.json(calls);
  } catch (err) {
    next(err);
  }
}

module.exports = { startCall, endCall, getCallHistory };
