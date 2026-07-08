require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Indent = require('../models/Indent.schema');
const Requisition = require('../models/Requisition.schema');
const StoreOutward = require('../models/Store-outward.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const Budget = require('../models/Budget.schema');
const StoreItem = require('../models/Store-item.schema');
const StockStatement = require('../models/Stock-statement.schema');
const { getFiscalYear } = require('./fiscal');
const { formatDelay, replanSequentialStages } = require('./workflow');
const { ensureFmsTemplates, syncAllOpenTasks } = require('../services/fms.service');
const { fetchHolidayDates } = require('./business-time');

const dropIfExists = async (collection, name) => {
  try {
    await collection.dropIndex(name);
    console.log(`Dropped index ${collection.collectionName}.${name}`);
  } catch (err) {
    if (!String(err.message).includes('index not found')) console.log(`Skip ${collection.collectionName}.${name}: ${err.message}`);
  }
};

const applyStage = (stages = [], key, actual, status = 'Yes') => {
  if (!actual) return stages;
  return stages.map((stage) => {
    const s = typeof stage.toObject === 'function' ? stage.toObject() : { ...stage };
    if (s.key === key) {
      s.actual = s.actual || actual;
      s.status = s.status === 'Pending' ? status : s.status;
      s.timeDelay = s.timeDelay || formatDelay(s.planned, s.actual);
    }
    return s;
  });
};

const holidayCache = new Map();
const getHolidays = async (tenantId) => {
  const key = String(tenantId);
  if (!holidayCache.has(key)) holidayCache.set(key, await fetchHolidayDates(tenantId));
  return holidayCache.get(key);
};


const normalizeItemType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('chemical')) return 'Chemical';
  if (v.includes('packing')) return 'Packing Material';
  if (v.includes('hard coke')) return 'Hard Coke';
  if (v.includes('paint')) return 'Paint';
  if (v.includes('grinding')) return 'Grinding Wheel';
  if (v.includes('fire')) return 'Fire Wood';
  if (v.includes('lime')) return 'Lime Stone';
  if (v.includes('repair')) return 'Repair';
  if (v.includes('capital')) return 'Capital';
  if (v.includes('raw')) return 'Raw Material';
  return 'Stores';
};

const deriveMotherItem = (item) => {
  if (item.motherItem) return item.motherItem;
  const fromStock = item.stocks?.find((s) => s.motherItem)?.motherItem;
  if (fromStock) return fromStock;
  const name = String(item.itemName || '').trim();
  if (!name) return 'General';
  const cleaned = name
    .replace(/\b\d+(\.\d+)?\s*(mm|inch|inches|kg|kgs|ltr|litre|pcs|set|nos)?\b/gi, '')
    .replace(/\s+\d+\s*("|'|”|″)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || name;
};

const migrateBudgetAndItemMasters = async () => {
  let itemCount = 0;
  for await (const item of StoreItem.find({})) {
    const nextType = item.itemType || normalizeItemType(item.productCategory || item.category);
    const nextMother = deriveMotherItem(item);
    let changed = false;
    if (item.itemType !== nextType) { item.itemType = nextType; changed = true; }
    if (!item.motherItem) { item.motherItem = nextMother; changed = true; }
    if (changed) { await item.save({ validateBeforeSave: false }); itemCount += 1; }
  }

  let budgetCount = 0;
  for await (const budget of Budget.find({})) {
    let changed = false;
    const firstLine = budget.lines?.[0];
    if (!budget.foundry && firstLine?.foundry) { budget.foundry = firstLine.foundry; changed = true; }
    if (!budget.department && firstLine?.department) { budget.department = firstLine.department; changed = true; }
    budget.lines = await Promise.all((budget.lines || []).map(async (line) => {
      const next = typeof line.toObject === 'function' ? line.toObject() : { ...line };
      const item = next.storeItemId ? await StoreItem.findById(next.storeItemId).lean() : await StoreItem.findOne({ tenantId: budget.tenantId, skuCode: next.skuCode }).lean();
      if (item) {
        next.itemType = next.itemType || item.itemType || normalizeItemType(item.productCategory);
        next.motherItem = next.motherItem || item.motherItem || item.itemName;
      } else {
        next.itemType = next.itemType || 'Stores';
        next.motherItem = next.motherItem || next.itemName;
      }
      if (next.consumptionPerKgPerMonth != null && next.estimatedCastingQty != null) {
        next.requiredQtyForMonth = Number(next.requiredQtyForMonth || (Number(next.consumptionPerKgPerMonth) * Number(next.estimatedCastingQty)) || 0);
        next.finalOrderQty = Number(next.finalOrderQty || next.requiredQtyForMonth || 0);
        next.totalValue = Number(next.totalValue || (next.finalOrderQty * Number(next.rateAsPerLastPurchase || 0)) || 0);
      }
      return next;
    }));
    if (!budget.foundry) { budget.foundry = 'D. I'; changed = true; }
    if (!budget.department) { budget.department = 'GENERAL'; changed = true; }
    const total = (budget.lines || []).reduce((sum, line) => sum + Number(line.totalValue || 0), 0);
    if (Number(budget.totalBudgetValue || 0) !== total) { budget.totalBudgetValue = total; changed = true; }
    if (changed || true) { await budget.save({ validateBeforeSave: false }); budgetCount += 1; }
  }
  console.log(`Budget/item master migration complete: items=${itemCount}, budgets=${budgetCount}`);
};

const migrateWorkflowActuals = async () => {
  let indentCount = 0;
  for await (const indent of Indent.find({})) {
    const holidays = await getHolidays(indent.tenantId);
    let stages = indent.workflowStages || [];
    stages = applyStage(stages, 'indent_to_purchase', indent.storeAckActual, indent.storeAckStatus || 'Yes');
    stages = applyStage(stages, 'quote_po', indent.poActual, indent.poStatus || 'Yes');
    indent.workflowStages = replanSequentialStages(stages, 'indent', indent.createdAt || indent.indentDate || new Date(), holidays);
    await indent.save();
    indentCount += 1;
  }

  let poCount = 0;
  for await (const po of PurchaseOrder.find({})) {
    const holidays = await getHolidays(po.tenantId);
    let stages = po.workflowStages || [];
    stages = applyStage(stages, 'supplier_followup_2h', po.followUp1Actual, po.followUp1Status || 'Yes');
    stages = applyStage(stages, 'supplier_followup_7d', po.followUp2Actual, po.followUp2Status || 'Yes');
    stages = applyStage(stages, 'supplier_followup_2d', po.followUp3Actual, po.followUp3Status || 'Yes');
    if (['Fully Received', 'Closed'].includes(po.status)) {
      const actual = po.updatedAt || po.poDate || new Date();
      stages = applyStage(stages, 'supplier_followup_2h', actual, 'Yes');
      stages = applyStage(stages, 'supplier_followup_7d', actual, 'Yes');
      stages = applyStage(stages, 'supplier_followup_2d', actual, 'Yes');
    }
    po.workflowStages = replanSequentialStages(stages, 'po', po.createdAt || po.poDate || new Date(), holidays);
    await po.save();
    poCount += 1;
  }

  let grnCount = 0;
  for await (const grn of GoodsReceipt.find({})) {
    const holidays = await getHolidays(grn.tenantId);
    let stages = grn.workflowStages || [];
    stages = applyStage(stages, 'receive_material', grn.gateChecklistAt || grn.actualReceiptDate, 'Yes');
    stages = applyStage(stages, 'quality_quantity_check', grn.qqCheckActual, grn.qqCheckStatus === 'Failed' ? 'No' : 'Yes');
    stages = applyStage(stages, 'return_material', grn.returnedAt, grn.materialReturned ? 'Yes' : 'Pending');
    stages = applyStage(stages, 'store_material', grn.storeActual || grn.stockAddedAt, grn.stockAdded ? 'Yes' : 'Pending');
    stages = applyStage(stages, 'invoice_to_ho', grn.invoiceSentToHOActual, 'Yes');
    stages = applyStage(stages, 'accounts_process', grn.accountsActual, 'Yes');
    grn.workflowStages = replanSequentialStages(stages, 'grn', grn.actualReceiptDate || grn.createdAt || new Date(), holidays);
    await grn.save();
    grnCount += 1;
  }
  console.log(`Synced FMS actual/status display: indents=${indentCount}, purchase_orders=${poCount}, goods_receipts=${grnCount}`);
};

const migrateQsfNumbers = async () => {
  const groups = new Map();
  const pos = await PurchaseOrder.find({ $or: [{ qsfNo: { $exists: false } }, { qsfNo: '' }, { qsfNo: null }] }).sort({ poDate: 1, poSeqNo: 1 });
  for (const po of pos) {
    const fy = getFiscalYear(po.poDate || po.createdAt || new Date());
    const key = `${po.tenantId}:${fy}`;
    if (!groups.has(key)) {
      const latest = await StoreSequence.findOneAndUpdate(
        { tenantId: po.tenantId, type: 'QSF_PUR', fiscalYear: fy },
        { $setOnInsert: { currentSeq: 0, prefix: `QSF/PUR/${fy}` } },
        { upsert: true, new: true }
      );
      groups.set(key, latest.currentSeq || 0);
    }
    const next = groups.get(key) + 1;
    groups.set(key, next);
    po.qsfNo = `QSF/PUR/${fy}/${String(next).padStart(2, '0')}`;
    await po.save();
  }
  for (const [key, seq] of groups.entries()) {
    const [tenantId, fy] = key.split(':');
    await StoreSequence.findOneAndUpdate(
      { tenantId, type: 'QSF_PUR', fiscalYear: fy },
      { currentSeq: seq, prefix: `QSF/PUR/${fy}` },
      { upsert: true }
    );
  }
  console.log(`QSF/PUR fiscal numbering migrated for ${pos.length} old POs.`);
};

(async () => {
  await connectDB();
  await dropIfExists(Indent.collection, 'indentNo_1');
  await dropIfExists(Indent.collection, 'tenantId_1_indentNo_1');
  await dropIfExists(Requisition.collection, 'requisitionNo_1');
  await dropIfExists(StoreOutward.collection, 'outwardNo_1');
  await dropIfExists(Budget.collection, 'tenantId_1_year_1_month_1');
  await migrateBudgetAndItemMasters();
  await Promise.all([
    Indent.syncIndexes(),
    Requisition.syncIndexes(),
    StoreOutward.syncIndexes(),
    PurchaseOrder.syncIndexes(),
    GoodsReceipt.syncIndexes(),
    StoreSequence.syncIndexes(),
    Budget.syncIndexes(),
    StoreItem.syncIndexes(),
    StockStatement.syncIndexes(),
  ]);
  await migrateWorkflowActuals();
  await migrateQsfNumbers();
  const tenants = await require('../models/Tenant.schema').find({ isDeleted: { $ne: true } });
  for (const tenant of tenants) { await ensureFmsTemplates(tenant._id); await syncAllOpenTasks(tenant._id); }
  console.log('FMS templates and user tasks synced for all tenants.');
  console.log('IMS migration complete: indexes, FMS actual/status sync, and QSF/PUR fiscal numbering are ready.');
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
