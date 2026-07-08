const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('store:read'), ctrl.listNotifications);
router.patch('/:id/read', requirePermission('store:read'), ctrl.markRead);

module.exports = router;
