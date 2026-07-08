const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fms-template.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('fms:admin'), ctrl.listTemplates);
router.put('/:flowType', requirePermission('fms:admin'), ctrl.updateTemplate);
router.post('/add-to-all', requirePermission('fms:admin'), ctrl.addStepToAll);
router.post('/apply-existing', requirePermission('fms:admin'), ctrl.applyExisting);
router.post('/complete-stage', requirePermission('fms:read'), ctrl.completeDocumentStage);

module.exports = router;
