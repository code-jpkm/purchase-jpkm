const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventory.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/next-sku', requirePermission('store:read'), ctrl.getNextSku);
router.get('/summary', requirePermission('store:read'), ctrl.getInventorySummary);
router.get('/for-indent', requirePermission('store:read'), ctrl.getItemsForIndent);
router.get('/', requirePermission('store:read'), ctrl.listItems);
router.get('/:id', requirePermission('store:read'), ctrl.getItem);
router.post('/', requirePermission('store:write'), ctrl.createItem);
router.put('/:id', requirePermission('store:write'), ctrl.updateItem);
router.delete('/:id', requirePermission('store:admin'), ctrl.deleteItem);

module.exports = router;
