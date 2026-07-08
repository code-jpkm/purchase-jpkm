const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/indent.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/open-groups', requirePermission('indent:read'), ctrl.listOpenIndentGroups);
router.get('/', requirePermission('indent:read'), ctrl.listIndents);
router.get('/:id', requirePermission('indent:read'), ctrl.getIndent);
router.post('/', requirePermission('indent:write'), ctrl.createIndent);
router.patch('/:id/acknowledge', requirePermission('indent:write'), ctrl.acknowledgeIndent);
router.patch('/:id/cancel', requirePermission('indent:write'), ctrl.cancelIndent);

module.exports = router;
