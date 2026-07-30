const { Router } = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const users = require('../controllers/userController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);

router.get('/me', users.getMe);
router.patch('/me', users.updateMe);
router.post('/me/avatar', upload.single('avatar'), users.uploadAvatar);
router.get('/search', users.searchUsers);
router.post('/:id/block', users.blockUser);
router.post('/:id/unblock', users.unblockUser);

module.exports = router;
