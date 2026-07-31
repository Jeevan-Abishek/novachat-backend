const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    bio: { type: String, maxlength: 200, default: '' },
    status: { type: String, enum: ['online', 'away', 'busy', 'offline'], default: 'offline' },
    customStatusText: { type: String, maxlength: 80, default: '' },

    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    otpCode: { type: String, select: false },
    otpExpires: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    refreshTokens: [{ type: String, select: false }], // supports multi-device sessions

    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    wallpaperUrl: { type: String, default: null },

    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ username: 'text', displayName: 'text' });

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, env.bcryptSaltRounds);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.otpCode;
  delete obj.passwordResetToken;
  delete obj.emailVerificationCode;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
