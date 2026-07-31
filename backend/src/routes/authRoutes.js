const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const auth = require('../controllers/authController');

const router = Router();

router.post(
  '/register',
  authLimiter,
  [
    body('displayName').isString().trim().isLength({ min: 1, max: 60 }),
    body('username').isString().trim().isLength({ min: 3, max: 24 }).matches(/^[a-z0-9_]+$/i),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }),
  ],
  validate,
  auth.register
);

router.post(
  '/verify-email',
  authLimiter,
  [body('userId').isMongoId(), body('code').isLength({ min: 6, max: 6 })],
  validate,
  auth.verifyEmail
);

router.post(
  '/login',
  authLimiter,
  [body('identifier').isString().trim().notEmpty(), body('password').isString().notEmpty()],
  validate,
  auth.login
);

router.post(
  '/verify-otp',
  authLimiter,
  [body('userId').isMongoId(), body('code').isLength({ min: 6, max: 6 })],
  validate,
  auth.verifyOtp
);

router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);

router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  auth.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  [body('token').isString().notEmpty(), body('newPassword').isString().isLength({ min: 8 })],
  validate,
  auth.resetPassword
);

module.exports = router;
