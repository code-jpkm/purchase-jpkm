const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/goods-receipt.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('grn:read'), ctrl.listGRNs);
router.get('/:id/note-pdf', requirePermission('grn:read'), ctrl.downloadNotePdf);
router.get('/:id', requirePermission('grn:read'), ctrl.getGRN);
router.post('/', requirePermission('grn:write'), ctrl.createGRN);
router.patch('/:id/qc', requirePermission('grn:write'), ctrl.processQC);
router.post('/:id/qc', requirePermission('grn:write'), ctrl.processQC); // mobile compatibility
router.patch('/:id/return', requirePermission('grn:write'), ctrl.returnMaterial);
router.patch('/:id/invoice-sent', requirePermission('grn:write'), ctrl.markInvoiceSent);
router.patch('/:id/accounts-processed', requirePermission('grn:write'), ctrl.markAccountsProcessed);

module.exports = router;
