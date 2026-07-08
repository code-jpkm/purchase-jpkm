const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/outward.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('outward:read'), ctrl.listOutwards);
router.post('/', requirePermission('outward:write'), ctrl.createOutward);

module.exports = router;
