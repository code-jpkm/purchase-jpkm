const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ai-monitoring.controller');
const { requirePermission } = require('../middleware/auth');
router.get('/', requirePermission('ai:use'), ctrl.overview);
router.post('/run', requirePermission('ai:use'), ctrl.runNow);
router.patch('/:id/status', requirePermission('ai:use'), ctrl.resolveFinding);
module.exports = router;
