const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');

// Auth guard on all store routes
router.use(authMiddleware, tenantMiddleware);

// Mount sub-routers
router.use('/inventory', require('./inventory.routes'));
router.use('/indents', require('./indent.routes'));
router.use('/purchase-orders', require('./purchase-order.routes'));
router.use('/grn', require('./grn.routes'));
router.use('/outward', require('./outward.routes'));
router.use('/requisitions', require('./requisition.routes'));
router.use('/idt', require('./idt.routes'));
router.use('/stock-statement', require('./stock-statement.routes'));
router.use('/budgets', require('./budget.routes'));
router.use('/vendors', require('./vendor.routes'));
router.use('/ai', require('./ai.routes'));
router.use('/ai-monitoring', require('./ai-monitoring.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/foundries', require('./foundry.routes'));
router.use('/holidays', require('./holiday.routes'));
router.use('/fms-templates', require('./fms-template.routes'));
router.use('/users', require('./user.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/master-data', require('./master-data.routes'));
router.use('/help-tickets', require('./help-ticket.routes'));
router.use('/costing', require('./costing.routes'));
router.use('/imports', require('./import.routes'));
router.use('/google-sheets', require('./google-sheet.routes'));

module.exports = router;
