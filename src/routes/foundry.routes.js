const express = require('express');
const router = express.Router();
const {
  listFoundries, getFoundry, createFoundry, updateFoundry, deleteFoundry,
  addDepartment, updateDepartment, deleteDepartment, getFlatList,
} = require('../controllers/foundry.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/flat', requirePermission('foundry:read'), getFlatList);
router.get('/', requirePermission('foundry:read'), listFoundries);
router.get('/:id', requirePermission('foundry:read'), getFoundry);
router.post('/', requirePermission('foundry:write'), createFoundry);
router.put('/:id', requirePermission('foundry:write'), updateFoundry);
router.delete('/:id', requirePermission('foundry:write'), deleteFoundry);
router.post('/:id/departments', requirePermission('foundry:write'), addDepartment);
router.put('/:id/departments/:deptId', requirePermission('foundry:write'), updateDepartment);
router.delete('/:id/departments/:deptId', requirePermission('foundry:write'), deleteDepartment);

module.exports = router;
