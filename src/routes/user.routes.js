const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/user.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('user:read'), ctrl.listUsers);
router.post('/', requirePermission('user:write'), ctrl.createUser);
router.put('/:id', requirePermission('user:write'), ctrl.updateUser);
router.delete('/:id', requirePermission('user:write'), ctrl.deleteUser);

module.exports = router;
