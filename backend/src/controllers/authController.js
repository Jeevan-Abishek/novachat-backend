const crypto = require('crypto');
const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/auth/refresh',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

function generateCode(length = 6) {
  return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
}

async function issueTokenPair(user, res) {
  const payload = { sub: user._id.toString(), username: user.username };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  user.refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5); // cap sessions/device count
  await user.save();

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
  return accessToken;
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { displayName, username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) throw new ApiError(409, 'Email or username already in use');

    const passwordHash = await User.hashPassword(password);
    const emailVerificationCode = generateCode();

    const user = await User.create({
      displayName,
      username,
      email,
      passwordHash,
      emailVerificationCode,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000,
    });

    // In production: enqueue a background worker job to send this via email provider.
    logger.info(`Verification code for ${email}: ${emailVerificationCode}`);

    res.status(201).json({ message: 'Account created. Check your email to verify.', userId: user._id });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-email
async function verifyEmail(req, res, next) {
  try {
    const { userId, code } = req.body;
    const user = await User.findById(userId).select('+emailVerificationCode +emailVerificationExpires');
    if (!user) throw new ApiError(404, 'User not found');
    if (user.emailVerified) return res.json({ message: 'Already verified' });

    if (user.emailVerificationCode !== code || user.emailVerificationExpires < Date.now()) {
      throw new ApiError(400, 'Invalid or expired verification code');
    }

    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { identifier, password } = req.body; // identifier = email or username
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select(
      '+passwordHash'
    );
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Step-up: send OTP for an extra verification layer instead of logging in directly.
    const otpCode = generateCode();
    user.otpCode = otpCode;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    logger.info(`OTP for ${user.email}: ${otpCode}`);
    res.json({ message: 'OTP sent', userId: user._id, requiresOtp: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res, next) {
  try {
    const { userId, code, rememberMe } = req.body;
    const user = await User.findById(userId).select('+otpCode +otpExpires');
    if (!user) throw new ApiError(404, 'User not found');

    if (user.otpCode !== code || user.otpExpires < Date.now()) {
      throw new ApiError(400, 'Invalid or expired OTP');
    }

    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.status = 'online';
    user.lastSeenAt = new Date();
    await user.save();

    const accessToken = await issueTokenPair(user, res);
    if (rememberMe) {
      res.cookie('rememberMe', '1', { ...REFRESH_COOKIE_OPTS, path: '/', maxAge: 60 * 24 * 60 * 60 * 1000 });
    }

    res.json({ accessToken, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new ApiError(401, 'No refresh token provided');

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(token)) {
      throw new ApiError(401, 'Refresh token invalid or revoked');
    }

    // Rotate the refresh token to limit replay-attack windows.
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    const accessToken = await issueTokenPair(user, res);

    res.json({ accessToken });
  } catch (err) {
    next(new ApiError(401, 'Session expired, please log in again'));
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await User.updateOne({ refreshTokens: token }, { $pull: { refreshTokens: token } });
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Always respond 200 to avoid leaking which emails are registered.
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    logger.info(`Password reset token for ${email}: ${resetToken}`);
    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) throw new ApiError(400, 'Reset token invalid or expired');

    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // force re-login on all devices
    await user.save();

    res.json({ message: 'Password reset successful. Please log in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyEmail,
  login,
  verifyOtp,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
