const User = require('../models/User');
const { ApiError } = require('../middleware/errorHandler');
const { uploadBuffer } = require('../config/cloudinary');

// GET /api/users/me
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(user.toSafeJSON());
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/me
async function updateMe(req, res, next) {
  try {
    const allowed = ['displayName', 'bio', 'theme', 'customStatusText'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    res.json(user.toSafeJSON());
  } catch (err) {
    next(err);
  }
}

// POST /api/users/me/avatar  (multipart upload -> Cloudinary)
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'No file uploaded');

    const result = await uploadBuffer(req.file.buffer, {
      folder: 'novachat/avatars',
      transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }],
    });

    const user = await User.findByIdAndUpdate(req.user.id, { avatarUrl: result.secure_url }, { new: true });
    res.json({ avatarUrl: user.avatarUrl });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/search?q=
async function searchUsers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const users = await User.find(
      { $text: { $search: q }, _id: { $ne: req.user.id } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20)
      .select('displayName username avatarUrl status');

    res.json(users);
  } catch (err) {
    next(err);
  }
}

// POST /api/users/:id/block
async function blockUser(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.user.id) throw new ApiError(400, "You can't block yourself");

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { blockedUsers: id } });
    res.json({ message: 'User blocked' });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/:id/unblock
async function unblockUser(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: req.params.id } });
    res.json({ message: 'User unblocked' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, uploadAvatar, searchUsers, blockUser, unblockUser };
