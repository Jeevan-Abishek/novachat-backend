const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const chats = require('../controllers/chatController');

const router = Router();
router.use(authenticate);

router.get('/', chats.listChats);
router.post('/direct', chats.createOrGetDirectChat);
router.post('/group', chats.createGroup);
router.patch('/:id/pin', chats.togglePin);
router.patch('/:id/archive', chats.toggleArchive);
router.patch('/:id/members/:memberId/role', chats.updateMemberRole);

module.exports = router;
