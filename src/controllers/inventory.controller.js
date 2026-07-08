const StoreItem = require('../models/Store-item.schema');
const StoreNotification = require('../models/Notification-store.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const Uom = require('../models/Uom.schema');
const MotherItem = require('../models/Mother-item.schema');
const { classifyStock, getHistoricalDailyAverage } = require('../utils/inventory-health');
const { buildItemLocationFilter, getStockEntry } = require('../utils/inventory-query');

const ITEM_TYPES = ['Raw Material', 'Chemical', 'Packing Material', 'Hard Coke', 'Paint', 'Stores', 'Grinding Wheel', 'Fire Wood', 'Lime Stone', 'Repair', 'Capital'];
const canonicalItemType = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Stores';
  const norm = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hit = ITEM_TYPES.find((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === norm);
  return hit || 'Stores';
};
const ensureUom = async (tenantId, code) => {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  return Uom.findOneAndUpdate({ tenantId, code: c }, { tenantId, code: c, name: c, isActive: true, isDeleted: false }, { upsert: true, new: true, setDefaultsOnInsert: true });
};
const ensureMotherItem = async (tenantId, name, itemType) => {
  const n = String(name || '').trim().toUpperCase();
  if (!n) return null;
  return MotherItem.findOneAndUpdate({ tenantId, name: n }, { tenantId, name: n, itemType: canonicalItemType(itemType), isActive: true, isDeleted: false }, { upsert: true, new: true, setDefaultsOnInsert: true });
};

const enrichInventoryHealth = async (tenantId, items, foundry, department) => {
  const docs = [];
  for (const raw of items) {
    const obj = raw.toObject ? raw.toObject() : { ...raw };
    const exactStock = (foundry || department) ? getStockEntry(obj, foundry, department) : null;
    const stocksToUse = exactStock ? [exactStock] : (obj.stocks || []);
    obj.stockHealth = [];
    for (const st of stocksToUse) {
      const hist = await getHistoricalDailyAverage(tenantId, obj.skuCode, st.foundry, st.department, 90);
      obj.stockHealth.push({ foundry: st.foundry, department: st.department, ...classifyStock(st, hist) });
    }
    obj.selectedStock = exactStock ? {
      foundry: exactStock.foundry,
      department: exactStock.department,
      currentQty: Number(exactStock.currentQty || 0),
      maxLevel: Number(exactStock.maxLevel || 0),
      currentSeason: exactStock.currentSeason || 'Normal',
    } : null;
    obj.overallStockStatus = obj.stockHealth.some((h) => h.status === 'ZERO') ? 'ZERO'
      : obj.stockHealth.some((h) => h.status === 'LOW') ? 'LOW'
      : obj.stockHealth.some((h) => h.status === 'MEDIUM') ? 'MEDIUM'
      : obj.stockHealth.some((h) => h.status === 'HIGH') ? 'HIGH' : 'IN RANGE';
    docs.push(obj);
  }
  return docs;
};

// GET /api/store/items
const listItems = async (req, res) => {
  try {
    const { search, category, foundry, department, lowStock, page = 1, limit = 50 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } };

    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { skuCode: { $regex: search, $options: 'i' } },
        { hsnCode: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.itemType = category;

    if (foundry || department) {
      const locationFilter = buildItemLocationFilter(foundry, department);
      if (locationFilter) query.$and = [...(query.$and || []), locationFilter];
    }

    if (lowStock === 'true') {
      // Filter items where totalAvailableQty <= 25% of any maxLevel
      query.$expr = {
        $lte: ['$totalAvailableQty', { $multiply: [{ $max: '$stocks.maxLevel' }, 0.25] }],
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      StoreItem.find(query)
        .sort({ skuCode: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('lastVendorId', 'name vendorCode'),
      StoreItem.countDocuments(query),
    ]);

    const enriched = await enrichInventoryHealth(req.tenantId, items, foundry, department);
    res.json({ success: true, data: enriched, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/items/:id
const getItem = async (req, res) => {
  try {
    const item = await StoreItem.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false })
      .populate('lastVendorId', 'name vendorCode contactPerson email phone');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const buildStockFromBody = (body) => {
  if (Array.isArray(body.stocks) && body.stocks.length) return body.stocks;
  if (!body.foundry || !body.department) return [];
  const opening = Number(body.openingStockQty ?? body.currentQty ?? 0);
  return [{
    foundry: body.foundry,
    department: body.department,
    dailyAvgConsumptionLow: Number(body.dailyAvgConsumptionLow || 0),
    dailyAvgConsumptionNormal: Number(body.dailyAvgConsumptionNormal || 0),
    dailyAvgConsumptionPeak: Number(body.dailyAvgConsumptionPeak || 0),
    currentSeason: body.currentSeason || 'Normal',
    leadTime: Number(body.leadTime || 0),
    safetyFactor: Number(body.safetyFactor || 1),
    maxLevel: Number(body.maxLevel || 0),
    openingStockQty: opening,
    currentQty: opening,
    qtyInDepartment: opening,
    sendToMonthlyStock: !!body.sendToMonthlyStock,
    motherItem: body.motherItem || '',
    documentLink: body.documentLink || '',
  }];
};

const generateSkuCode = async (tenantId) => {
  const seq = await StoreSequence.nextSeq(tenantId, 'STORE_ITEM', 'MASTER', 'JPK/STOR');
  return `JPK/STOR/${String(seq).padStart(3, '0')}`;
};

const getNextSku = async (req, res) => {
  try {
    const seqDoc = await StoreSequence.findOne({ tenantId: req.tenantId, type: 'STORE_ITEM', fiscalYear: 'MASTER' }).lean();
    const next = Number(seqDoc?.currentSeq || 0) + 1;
    res.json({ success: true, skuCode: `JPK/STOR/${String(next).padStart(3, '0')}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/store/items
const createItem = async (req, res) => {
  try {
    let skuCode = String(req.body.skuCode || '').trim().toUpperCase();
    if (!skuCode || skuCode === 'AUTO') skuCode = await generateSkuCode(req.tenantId);
    const existing = await StoreItem.findOne({ tenantId: req.tenantId, skuCode });
    if (existing) return res.status(400).json({ success: false, message: 'SKU code already exists' });

    const stocks = buildStockFromBody(req.body);
    const itemType = canonicalItemType(req.body.itemType);
    const uomCode = String(req.body.uom || 'PCS').trim().toUpperCase();
    const secondaryUomCode = String(req.body.secondaryUom || '').trim().toUpperCase();
    const [uomDoc, secondaryUomDoc, motherDoc] = await Promise.all([
      ensureUom(req.tenantId, uomCode),
      secondaryUomCode ? ensureUom(req.tenantId, secondaryUomCode) : null,
      ensureMotherItem(req.tenantId, req.body.motherItem || req.body.itemName, itemType),
    ]);
    const payload = { ...req.body, skuCode, tenantId: req.tenantId, stocks, itemType };
    payload.uom = uomCode;
    payload.uomId = uomDoc?._id;
    payload.secondaryUom = secondaryUomCode;
    payload.secondaryUomId = secondaryUomDoc?._id;
    payload.motherItem = motherDoc?.name || String(req.body.motherItem || req.body.itemName || '').trim().toUpperCase();
    payload.motherItemId = motherDoc?._id;
    payload.totalAvailableQty = stocks.reduce((sum, st) => sum + Number(st.currentQty || 0), 0);
    const item = await StoreItem.create(payload);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/store/items/:id
const updateItem = async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.foundry; delete payload.department; delete payload.openingStockQty;
    const item = await StoreItem.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (Array.isArray(item.stocks)) {
      item.recalcTotal();
      await item.save();
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/store/items/:id (soft)
const deleteItem = async (req, res) => {
  try {
    await StoreItem.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { isDeleted: true }
    );
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/items/summary — dashboard summary
const getInventorySummary = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const [total, lowStock, zeroStock, totalByCategory] = await Promise.all([
      StoreItem.countDocuments({ tenantId, isDeleted: false, isActive: true }),
      StoreItem.countDocuments({
        tenantId,
        isDeleted: false,
        isActive: true,
        $expr: { $and: [
          { $gt: ['$totalAvailableQty', 0] },
          { $lte: ['$totalAvailableQty', { $multiply: [{ $max: '$stocks.maxLevel' }, 0.25] }] }
        ]}
      }),
      StoreItem.countDocuments({ tenantId, isDeleted: false, isActive: true, totalAvailableQty: 0 }),
      StoreItem.aggregate([
        { $match: { tenantId: require('mongoose').Types.ObjectId.createFromHexString(tenantId.toString()), isDeleted: false } },
        { $group: { _id: '$itemType', count: { $sum: 1 }, totalValue: { $sum: { $multiply: ['$totalAvailableQty', '$rate'] } } } },
      ]),
    ]);
    res.json({ success: true, data: { total, lowStock, zeroStock, byCategory: totalByCategory } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/items/for-indent — dependent dropdown for indent/requisition/IDT
const getItemsForIndent = async (req, res) => {
  try {
    const { foundry, department, search, onlyAvailable } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } };
    const and = [];
    const locationFilter = buildItemLocationFilter(foundry, department);
    if (locationFilter) and.push(locationFilter);
    if (search) {
      and.push({ $or: [
        { itemName: { $regex: search, $options: 'i' } },
        { skuCode: { $regex: search, $options: 'i' } },
      ] });
    }
    if (and.length) query.$and = and;

    let items = await StoreItem.find(query, {
      skuCode: 1, itemName: 1, itemType: 1, motherItem: 1, hsnCode: 1, gstPercent: 1, uom: 1, secondaryUom: 1, totalAvailableQty: 1, stocks: 1,
      lastVendorName: 1, lastVendorId: 1, rate: 1, lastPurchaseDate: 1,
    }).sort({ itemName: 1 }).limit(500);

    const data = await enrichInventoryHealth(req.tenantId, items, foundry, department);
    const filtered = onlyAvailable === 'true'
      ? data.filter((item) => item.stockHealth.some((h) => Number(h.currentQty || 0) > 0))
      : data;
    res.json({ success: true, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/notifications
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const query = { tenantId: req.tenantId };
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total] = await Promise.all([
      StoreNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      StoreNotification.countDocuments(query),
    ]);
    res.json({ success: true, data: notifications, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listItems, getItem, createItem, updateItem, deleteItem, getInventorySummary, getItemsForIndent, getNotifications, getNextSku };
