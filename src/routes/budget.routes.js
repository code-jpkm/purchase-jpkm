const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/budget.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/template', requirePermission('budget:read'), ctrl.getBudgetTemplate);
router.get('/master', requirePermission('budget:read'), ctrl.getMasterBudget);
router.get('/', requirePermission('budget:read'), ctrl.listBudgets);
router.get('/:id', requirePermission('budget:read'), ctrl.getBudget);
router.post('/', requirePermission('budget:write'), ctrl.createBudget);
router.post('/:id/check-variance', requirePermission('budget:read'), ctrl.checkBudgetVariance);
router.patch('/:id/approve', requirePermission('budget:approve'), ctrl.approveBudget);

module.exports = router;
