const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/outward.controller');
const { requirePermission } = require('../middleware/auth');

router.post('/', requirePermission('outward:write'), ctrl.createIDT);

module.exports = router;
