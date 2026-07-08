const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/outward.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('requisition:read'), ctrl.listRequisitions);
router.post('/', requirePermission('requisition:write'), ctrl.createRequisition);

module.exports = router;
