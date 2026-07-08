const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vendor.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('vendor:read'), ctrl.listVendors);
router.get('/:id', requirePermission('vendor:read'), ctrl.getVendor);
router.post('/', requirePermission('vendor:write'), ctrl.createVendor);
router.put('/:id', requirePermission('vendor:write'), ctrl.updateVendor);
router.delete('/:id', requirePermission('vendor:admin'), ctrl.deleteVendor);

module.exports = router;
