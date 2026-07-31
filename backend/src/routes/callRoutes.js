const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const calls = require('../controllers/callController');

const router = Router();
router.use(authenticate);

router.post('/', calls.startCall);
router.patch('/:id/end', calls.endCall);
router.get('/:chatId/history', calls.getCallHistory);

module.exports = router;
