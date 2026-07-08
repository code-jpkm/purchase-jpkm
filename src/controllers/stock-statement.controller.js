const mongoose = require('mongoose');
const StockStatement = require('../models/Stock-statement.schema');
const StoreItem = require('../models/Store-item.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const StoreOutward = require('../models/Store-outward.schema');
const { getMonthLabel, getPeriodDates } = require('../utils/fiscal');

// POST /api/store/stock-statement/generate
const generateStockStatement = async (req, res) => {
  try {
    const { year, month } = req.body;
    const tenantId = req.tenantId;

    const existing = await StockStatement.findOne({ tenantId, year, month });
    if (existing && existing.isFinalised) {
      return res.status(400).json({ success: false, message: 'Stock statement already finalised for this month' });
    }

    const { periodStart, periodEnd } = getPeriodDates(year, month);
    const tenantObjectId = tenantId instanceof mongoose.Types.ObjectId ? tenantId : new mongoose.Types.ObjectId(String(tenantId));
    const monthLabel = getMonthLabel(year, month);

    // Get all active items
    const items = await StoreItem.find({ tenantId, isDeleted: false, isActive: true }).sort({ skuCode: 1 });

    const rawLines = await Promise.all(
      items.map(async (item) => {
        const receivedDocs = await GoodsReceipt.aggregate([
          { $match: { tenantId: tenantObjectId, skuCode: item.skuCode, actualReceiptDate: { $gte: periodStart, $lte: periodEnd }, status: { $in: ['Stocked', 'Partially Returned'] } } },
          { $group: { _id: null, total: { $sum: { $subtract: ['$receivedQty', { $ifNull: ['$returnedQty', 0] }] } } } },
        ]);
        const invoiceQty = receivedDocs[0]?.total || 0;
        const consumedDI = await StoreOutward.aggregate([
          { $match: { tenantId: tenantObjectId, skuCode: item.skuCode, outwardDate: { $gte: periodStart, $lte: periodEnd }, toFoundry: 'D. I' } },
          { $group: { _id: null, total: { $sum: '$issuedQty' } } },
        ]);
        const consumedCI = await StoreOutward.aggregate([
          { $match: { tenantId: tenantObjectId, skuCode: item.skuCode, outwardDate: { $gte: periodStart, $lte: periodEnd }, toFoundry: 'C. I' } },
          { $group: { _id: null, total: { $sum: '$issuedQty' } } },
        ]);
        const diConsumed = consumedDI[0]?.total || 0;
        const ciConsumed = consumedCI[0]?.total || 0;
        const currentQty = item.totalAvailableQty || 0;
        const totalConsumed = diConsumed + ciConsumed;
        const openingStock = currentQty + totalConsumed - invoiceQty;
        const motherItem = item.motherItem || item.stocks?.find((s) => s.motherItem)?.motherItem || item.itemName;
        return {
          skuCode: item.skuCode,
          itemName: motherItem,
          childItemName: item.itemName,
          uom: item.uom,
          openingStock: Math.max(0, openingStock),
          invoiceQty,
          totalQty: Math.max(0, openingStock + invoiceQty),
          consumedDI: diConsumed,
          consumedCI: ciConsumed,
          closingStock: Math.max(0, openingStock + invoiceQty - totalConsumed),
          productCategory: item.itemType || item.productCategory,
          preference: item.preference,
          sendToMonthlyStock: item.stocks.some((s) => s.sendToMonthlyStock),
          rate: item.rate || 0,
        };
      })
    );

    const groupedMap = new Map();
    rawLines.forEach((line) => {
      const key = `${line.productCategory || 'Stores'}|${line.itemName}|${line.uom}`;
      const g = groupedMap.get(key) || {
        skuCode: '',
        storeItemId: undefined,
        itemName: line.itemName,
        childItemName: line.childItemName,
        uom: line.uom,
        productCategory: line.productCategory || 'Stores',
        preference: line.preference,
        sendToMonthlyStock: line.sendToMonthlyStock,
        openingStock: 0,
        invoiceQty: 0,
        totalQty: 0,
        consumedDI: 0,
        consumedCI: 0,
        closingStock: 0,
        childCount: 0,
        childItems: [],
        rateTotal: 0,
      };
      g.childCount += 1;
      g.childItems.push(line.childItemName);
      g.openingStock += line.openingStock || 0;
      g.invoiceQty += line.invoiceQty || 0;
      g.totalQty += line.totalQty || 0;
      g.consumedDI += line.consumedDI || 0;
      g.consumedCI += line.consumedCI || 0;
      g.closingStock += line.closingStock || 0;
      g.rateTotal += line.rate || 0;
      groupedMap.set(key, g);
    });
    const lines = Array.from(groupedMap.values())
      .sort((a, b) => String(a.productCategory).localeCompare(String(b.productCategory)) || String(a.itemName).localeCompare(String(b.itemName)))
      .map((line, idx) => ({
        ...line,
        slNo: idx + 1,
        status: `${line.childCount} child item(s): ${line.childItems.slice(0, 4).join(', ')}${line.childItems.length > 4 ? '...' : ''}`,
        averageRate: line.childCount ? line.rateTotal / line.childCount : 0,
      }));

    const stmt = await StockStatement.findOneAndUpdate(
      { tenantId, year, month },
      {
        tenantId,
        year,
        month,
        monthLabel,
        periodStart,
        periodEnd,
        firstHalfEnd: new Date(year, month - 1, 15),
        secondHalfStart: new Date(year, month - 1, 16),
        lines,
        generatedBy: req.user.userId,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: stmt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/stock-statement
const listStockStatements = async (req, res) => {
  try {
    const stmts = await StockStatement.find({ tenantId: req.tenantId })
      .sort({ year: -1, month: -1 })
      .select('-lines')
      .populate('generatedBy', 'name');
    res.json({ success: true, data: stmts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/stock-statement/:year/:month
const getStockStatement = async (req, res) => {
  try {
    const { year, month } = req.params;
    const stmt = await StockStatement.findOne({
      tenantId: req.tenantId,
      year: parseInt(year),
      month: parseInt(month),
    }).populate('generatedBy', 'name').populate('finalisedBy', 'name');

    if (!stmt) return res.status(404).json({ success: false, message: 'Stock statement not found' });
    res.json({ success: true, data: stmt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/store/stock-statement/:id/finalise
const finaliseStockStatement = async (req, res) => {
  try {
    const stmt = await StockStatement.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, isFinalised: false },
      { isFinalised: true, finalisedAt: new Date(), finalisedBy: req.user.userId },
      { new: true }
    );
    if (!stmt) return res.status(400).json({ success: false, message: 'Already finalised or not found' });
    res.json({ success: true, data: stmt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateStockStatement, listStockStatements, getStockStatement, finaliseStockStatement };
