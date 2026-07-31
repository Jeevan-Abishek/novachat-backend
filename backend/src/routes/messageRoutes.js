const { Router } = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const messages = require('../controllers/messageController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);

router.get('/:chatId', messages.getHistory);
router.post('/:chatId', upload.array('attachments', 10), messages.sendMessage);
router.patch('/:id', messages.editMessage);
router.delete('/:id', messages.deleteMessage);
router.post('/:id/react', messages.toggleReaction);
router.post('/:id/star', messages.toggleStar);

module.exports = router;
