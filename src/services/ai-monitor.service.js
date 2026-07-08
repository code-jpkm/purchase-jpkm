const mongoose = require('mongoose');
const StoreItem = require('../models/Store-item.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const Budget = require('../models/Budget.schema');
const UserTask = require('../models/User-task.schema');
const CostingRun = require('../models/Costing-run.schema');
const StoreNotification = require('../models/Notification-store.schema');
const AiMonitorFinding = require('../models/Ai-monitor-finding.schema');
const { chatWithStoreAI } = require('./ai.service');

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const uniqKey = (f) => `${f.category}|${f.referenceModel || ''}|${f.referenceNo || ''}|${f.title}`;

async function saveFindings(tenantId, findings) {
  const saved = [];
  const seen = new Set();
  for (const raw of findings) {
    const f = { ...raw, tenantId, status: raw.status || 'Open' };
    const key = uniqKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    const doc = await AiMonitorFinding.findOneAndUpdate(
      { tenantId, category: f.category, referenceNo: f.referenceNo || '', title: f.title, status: { $ne: 'Resolved' } },
      { $set: f, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    saved.push(doc);
    if (['HIGH', 'CRITICAL'].includes(doc.severity)) {
      await StoreNotification.create({
        tenantId,
        type: 'AI_ALERT',
        title: `AI Monitor: ${doc.title}`,
        message: doc.message,
        referenceModel: doc.referenceModel || 'AIConversation',
        referenceId: doc.referenceId,
        referenceNo: doc.referenceNo,
        priority: doc.severity,
      }).catch(() => {});
    }
  }
  return saved;
}

function stockThreshold(stock) {
  const season = String(stock.currentSeason || 'Normal').toLowerCase();
  const daily = season.includes('peak') ? stock.dailyAvgConsumptionPeak : season.includes('low') ? stock.dailyAvgConsumptionLow : stock.dailyAvgConsumptionNormal;
  const reorder = (Number(daily) || 0) * (Number(stock.leadTime) || 0) * (Number(stock.safetyFactor) || 1);
  return reorder || Number(stock.maxLevel || 0) * 0.4;
}

async function runAIMonitoring(tenantId) {
  const tenantObjectId = tenantId instanceof mongoose.Types.ObjectId ? tenantId : new mongoose.Types.ObjectId(String(tenantId));
  const now = new Date();
  const findings = [];

  const [items, openTasks, pos, grns, budgets, costRuns] = await Promise.all([
    StoreItem.find({ tenantId, isDeleted: false, isActive: true }).limit(5000).lean(),
    UserTask.find({ tenantId, isDeleted: false, status: 'Pending' }).sort({ plannedAt: 1 }).limit(500).lean(),
    PurchaseOrder.find({ tenantId, isDeleted: false }).sort({ poDate: -1 }).limit(250).lean(),
    GoodsReceipt.find({ tenantId, isDeleted: false }).sort({ actualReceiptDate: -1 }).limit(500).lean(),
    Budget.find({ tenantId, isDeleted: false }).sort({ year: -1, month: -1 }).limit(500).lean(),
    CostingRun.find({ tenantId, isDeleted: false }).sort({ year: -1, month: -1 }).limit(50).lean(),
  ]);

  for (const item of items) {
    if (!item.uom || !item.itemName || !item.skuCode) findings.push({ category: 'DATA_QUALITY', severity: 'HIGH', title: `Incomplete item master: ${item.skuCode || item.itemName || 'Unknown item'}`, message: 'SKU, Item Name and UOM are compulsory for reliable purchase, costing and stock statement.', actionRequired: 'Correct item master immediately.', referenceModel: 'StoreItem', referenceId: item._id, referenceNo: item.skuCode, score: 80 });
    for (const stock of item.stocks || []) {
      const qty = Number(stock.currentQty || 0);
      const threshold = stockThreshold(stock);
      if (qty <= 0) findings.push({ category: 'STOCK', severity: 'CRITICAL', title: `Zero stock: ${item.itemName}`, message: `${item.skuCode} has zero stock in ${stock.foundry || '-'} / ${stock.department || '-'}.`, actionRequired: 'Raise indent or issue urgent PO.', referenceModel: 'StoreItem', referenceId: item._id, referenceNo: item.skuCode, score: 100, meta: { foundry: stock.foundry, department: stock.department } });
      else if (threshold && qty < threshold) findings.push({ category: 'STOCK', severity: 'HIGH', title: `Low stock: ${item.itemName}`, message: `${item.skuCode} has ${qty} ${item.uom}; reorder threshold is approx. ${threshold.toFixed(2)} ${item.uom}.`, actionRequired: 'Check budget and plan purchase.', referenceModel: 'StoreItem', referenceId: item._id, referenceNo: item.skuCode, score: 75, meta: { foundry: stock.foundry, department: stock.department, qty, threshold } });
      if (Number(stock.maxLevel || 0) > 0 && qty > Number(stock.maxLevel) * 1.5) findings.push({ category: 'STOCK', severity: 'MEDIUM', title: `High stock: ${item.itemName}`, message: `${item.skuCode} stock is above 150% of max level in ${stock.department}.`, actionRequired: 'Avoid fresh PO unless approved.', referenceModel: 'StoreItem', referenceId: item._id, referenceNo: item.skuCode, score: 45 });
    }
  }

  openTasks.filter((t) => t.plannedAt && new Date(t.plannedAt) < now).slice(0, 100).forEach((t) => findings.push({ category: 'FMS', severity: new Date(t.plannedAt) < new Date(Date.now() - 24*60*60*1000) ? 'CRITICAL' : 'HIGH', title: `Overdue FMS: ${t.stepWhat}`, message: `${t.userName || 'Assigned user'} has pending ${t.fmsType} task for ${t.referenceNo || ''}. Planned: ${new Date(t.plannedAt).toLocaleString('en-IN')}.`, actionRequired: 'Complete the FMS step or escalate to buddy/admin.', ownerName: t.userName, referenceModel: t.referenceModel, referenceId: t.referenceId, referenceNo: t.referenceNo, score: 90 }));

  pos.forEach((po) => {
    if (['Open', 'Partially Received', 'Issued'].includes(po.status)) {
      const age = Math.floor((now - new Date(po.poDate || po.createdAt)) / (24*60*60*1000));
      if (age > 30) findings.push({ category: 'PURCHASE', severity: 'HIGH', title: `Old open PO: ${po.poNo}`, message: `${po.poNo} is still ${po.status} after ${age} days.`, actionRequired: 'Follow up vendor or close/cancel PO.', referenceModel: 'PurchaseOrder', referenceId: po._id, referenceNo: po.poNo, score: 70 });
    }
    for (const line of po.items || po.subPOs || []) {
      const order = Number(line.orderedQty || line.orderQty || 0);
      const received = Number(line.receivedQty || 0);
      const returned = Number(line.returnedQty || 0);
      if (returned > 0 && po.status === 'Partially Received') findings.push({ category: 'GRN', severity: 'HIGH', title: `Returned item still shown partial: ${po.poNo}`, message: `${line.itemName || line.itemDescription || ''} has return qty ${returned}, PO status needs return-aware review.`, actionRequired: 'Check PO/GRN status sync and vendor replacement.', referenceModel: 'PurchaseOrder', referenceId: po._id, referenceNo: po.poNo, score: 80 });
      if (order && received < order && ageWithin(po.poDate || po.createdAt, 60)) findings.push({ category: 'PURCHASE', severity: 'MEDIUM', title: `PO balance pending: ${po.poNo}`, message: `${line.itemName || line.itemDescription || ''}: ordered ${order}, received ${received}.`, actionRequired: 'Follow up pending balance.', referenceModel: 'PurchaseOrder', referenceId: po._id, referenceNo: po.poNo, score: 50 });
    }
  });

  grns.forEach((g) => {
    if (g.noteType === 'Debit Note') findings.push({ category: 'VENDOR', severity: 'HIGH', title: `Debit note issued: ${g.vendorName}`, message: `${g.poNo} / ${g.itemDescription}: debit note value ₹${Number(g.noteValue || 0).toLocaleString('en-IN')}.`, actionRequired: 'Review vendor performance and recover debit note.', referenceModel: 'GoodsReceipt', referenceId: g._id, referenceNo: g.poNo, score: 85 });
    if (Number(g.deliveryDelayDays || 0) > 3) findings.push({ category: 'VENDOR', severity: 'MEDIUM', title: `Delivery delay: ${g.vendorName}`, message: `${g.poNo} delayed by ${g.deliveryDelayDays} day(s).`, actionRequired: 'Record vendor performance score.', referenceModel: 'GoodsReceipt', referenceId: g._id, referenceNo: g.poNo, score: 55 });
  });

  const currentBudget = budgets.filter((b) => b.year === now.getFullYear() && b.month === now.getMonth() + 1);
  if (!currentBudget.length) findings.push({ category: 'BUDGET', severity: 'HIGH', title: 'Current month budget missing', message: 'No approved/submitted budget found for current month.', actionRequired: 'Ask department heads to submit budget or admin to open special window.', referenceModel: 'Budget', score: 70 });

  const sortedCosts = [...costRuns].sort((a,b) => (a.year-b.year) || (a.month-b.month));
  for (let i = 1; i < sortedCosts.length; i++) {
    const prev = Number(sortedCosts[i-1].totalInputCostPerKg || 0);
    const curr = Number(sortedCosts[i].totalInputCostPerKg || 0);
    if (prev && curr > prev * 1.05) findings.push({ category: 'COSTING', severity: 'CRITICAL', title: `Cost increased: ${sortedCosts[i].costingNo}`, message: `Input cost per kg increased from ₹${prev.toFixed(2)} to ₹${curr.toFixed(2)}.`, actionRequired: 'Review material, power, labour and overhead contributors.', referenceModel: 'CostingRun', referenceId: sortedCosts[i]._id, referenceNo: sortedCosts[i].costingNo, score: 92 });
  }

  const saved = await saveFindings(tenantId, findings);
  return { totalFindings: saved.length, critical: saved.filter((f) => f.severity === 'CRITICAL').length, high: saved.filter((f) => f.severity === 'HIGH').length, medium: saved.filter((f) => f.severity === 'MEDIUM').length, low: saved.filter((f) => f.severity === 'LOW').length };
}

function ageWithin(date, days) {
  if (!date) return false;
  return (Date.now() - new Date(date).getTime()) < days * 24 * 60 * 60 * 1000;
}

async function geminiMonitorSummary(tenantId) {
  const findings = await AiMonitorFinding.find({ tenantId, status: 'Open' }).sort({ severity: 1, score: -1, createdAt: -1 }).limit(60).lean();
  if (!findings.length) return 'No open AI monitoring findings. System appears stable based on configured checks.';
  const result = await chatWithStoreAI([{ role: 'user', content: 'Give MD-level AI monitoring summary from these findings. Mention top risks, department/person actions, and first 5 urgent actions.' }], { aiMonitoringFindings: findings });
  return result.reply;
}

module.exports = { runAIMonitoring, geminiMonitorSummary };
