const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('store:read'), ctrl.getDashboard);

module.exports = router;
