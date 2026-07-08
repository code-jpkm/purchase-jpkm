const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/master-data.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/uoms', requirePermission('store:read'), ctrl.listUoms);
router.post('/uoms', requirePermission('store:write'), ctrl.createUom);
router.put('/uoms/:id', requirePermission('store:write'), ctrl.updateUom);
router.delete('/uoms/:id', requirePermission('store:admin'), ctrl.deleteUom);

router.get('/mother-items', requirePermission('store:read'), ctrl.listMotherItems);
router.post('/mother-items', requirePermission('store:write'), ctrl.createMotherItem);
router.put('/mother-items/:id', requirePermission('store:write'), ctrl.updateMotherItem);
router.delete('/mother-items/:id', requirePermission('store:admin'), ctrl.deleteMotherItem);

module.exports = router;
