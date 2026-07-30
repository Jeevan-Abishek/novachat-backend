const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const groups = require('../controllers/groupController');

const router = Router();
router.use(authenticate);

router.post('/:id/invite/regenerate', groups.regenerateInvite);
router.post('/join/:inviteLink', groups.joinByInvite);
router.patch('/:id/announcements-only', groups.setAnnouncementsOnly);
router.post('/:id/members/:memberId/remove', groups.removeMember);
router.post('/:id/polls', groups.createPoll);
router.post('/polls/:pollId/vote', groups.voteOnPoll);

module.exports = router;
