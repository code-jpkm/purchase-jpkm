const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchase-order.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/last-purchase/:skuCode', requirePermission('purchase:read'), ctrl.getLastPurchaseInfo);
router.get('/', requirePermission('purchase:read'), ctrl.listPOs);
router.get('/:id/pdf', requirePermission('purchase:read'), ctrl.downloadPOPDF);
router.get('/:id', requirePermission('purchase:read'), ctrl.getPO);
router.post('/', requirePermission('purchase:write'), ctrl.createPO);
router.patch('/:id/followup', requirePermission('purchase:write'), ctrl.recordFollowUp);
router.patch('/:id/cancel', requirePermission('purchase:write'), ctrl.cancelPO);

module.exports = router;
