const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stock-statement.controller');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('stock_statement:read'), ctrl.listStockStatements);
router.get('/:year/:month', requirePermission('stock_statement:read'), ctrl.getStockStatement);
router.post('/generate', requirePermission('stock_statement:write'), ctrl.generateStockStatement);
router.patch('/:id/finalise', requirePermission('stock_statement:write'), ctrl.finaliseStockStatement);

module.exports = router;
