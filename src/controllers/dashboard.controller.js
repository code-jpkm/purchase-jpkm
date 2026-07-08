const mongoose = require('mongoose');
const Indent = require('../models/Indent.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const StockStatement = require('../models/Stock-statement.schema');
const Requisition = require('../models/Requisition.schema');
const StoreItem = require('../models/Store-item.schema');
const { classifyStock, getHistoricalDailyAverage } = require('../utils/inventory-health');
const UserTask = require('../models/User-task.schema');
const { syncAllOpenTasks } = require('../services/fms.service');

const firstPendingStage = (stages = []) => (stages || []).find((s) => !s.actual && s.status === 'Pending');
const toDateText = (d) => (d ? new Date(d).toISOString() : null);

const buildCurrentFms = async (tenantId) => {
  const [indents, pos, grns] = await Promise.all([
    Indent.find({ tenantId, isDeleted: false, status: { $nin: ['Cancelled', 'Fully Received'] } }).sort({ updatedAt: -1 }).limit(200).lean(),
    PurchaseOrder.find({ tenantId, isDeleted: false, status: { $nin: ['Cancelled', 'Closed', 'Fully Received'] } }).sort({ updatedAt: -1 }).limit(200).lean(),
    GoodsReceipt.find({ tenantId, isDeleted: false, status: { $nin: ['Returned'] } }).sort({ updatedAt: -1 }).limit(200).lean(),
  ]);
  const rows = [];
  const push = (type, doc, refNo, subtitle, link) => {
    const stage = firstPendingStage(doc.workflowStages);
    if (!stage) return;
    rows.push({
      type,
      id: String(doc._id),
      refNo,
      subtitle,
      step: stage.what,
      who: stage.who,
      how: stage.how,
      planned: toDateText(stage.planned),
      status: stage.status,
      link,
    });
  };
  indents.forEach((d) => push('Indent', d, d.indentNo, `${d.foundry} / ${d.department} • ${d.itemName}`, '/indents'));
  pos.forEach((d) => push('Purchase Order', d, d.poNo, `${d.vendorName} • ${d.totalItems || d.subPOs?.length || 0} items`, '/purchase-orders'));
  grns.forEach((d) => push('Goods Receipt', d, d.poNo, `${d.subPoNo || ''} • ${d.itemDescription}`, '/grn'));
  return rows.sort((a, b) => new Date(a.planned || 0) - new Date(b.planned || 0)).slice(0, 30);
};

const buildUrgentMaterials = async (tenantId) => {
  const items = await StoreItem.find({ tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } }).limit(500).lean();
  const urgent = [];
  for (const item of items) {
    for (const st of item.stocks || []) {
      const hist = await getHistoricalDailyAverage(tenantId, item.skuCode, st.foundry, st.department, 90);
      const health = classifyStock(st, hist);
      if (['ZERO', 'LOW', 'MEDIUM'].includes(health.status)) {
        urgent.push({
          skuCode: item.skuCode,
          itemName: item.itemName,
          foundry: st.foundry,
          department: st.department,
          uom: item.uom,
          status: health.status,
          currentQty: health.currentQty,
          reorderLevel: health.reorderLevel,
          suggestedOrderQty: Math.max(0, Number(health.maxLevel || st.maxLevel || 0) - Number(health.currentQty || 0)),
        });
      }
    }
  }
  return urgent.sort((a, b) => ['ZERO', 'LOW', 'MEDIUM'].indexOf(a.status) - ['ZERO', 'LOW', 'MEDIUM'].indexOf(b.status)).slice(0, 25);
};

const buildVendorPerformance = async (tenantId) => {
  const grns = await GoodsReceipt.find({ tenantId, isDeleted: false }).sort({ actualReceiptDate: -1 }).limit(1000).lean();
  const map = new Map();
  grns.forEach((g) => {
    const key = g.vendorName || 'Unknown';
    const row = map.get(key) || { vendorName: key, receipts: 0, delayed: 0, returned: 0, totalDelayDays: 0 };
    row.receipts += 1;
    if ((g.deliveryDelayDays || 0) > 0) { row.delayed += 1; row.totalDelayDays += Number(g.deliveryDelayDays || 0); }
    if ((g.returnedQty || 0) > 0 || g.status === 'Returned' || g.status === 'Partially Returned') row.returned += 1;
    map.set(key, row);
  });
  const rows = Array.from(map.values()).map((v) => {
    const delayRate = v.receipts ? v.delayed / v.receipts : 0;
    const returnRate = v.receipts ? v.returned / v.receipts : 0;
    const score = Math.max(0, Math.round(100 - delayRate * 45 - returnRate * 45 - Math.min(10, v.totalDelayDays)));
    return { ...v, delayRate, returnRate, score, avgDelayDays: v.delayed ? Number((v.totalDelayDays / v.delayed).toFixed(1)) : 0 };
  }).sort((a, b) => b.score - a.score);
  return {
    best: rows.slice(0, 5),
    replace: rows.filter((v) => v.receipts >= 2 && (v.score < 60 || v.returnRate >= 0.25 || v.delayRate >= 0.5)).slice(0, 5),
  };
};

const getDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    await syncAllOpenTasks(tenantId);
    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const tomorrowStart = new Date(now); tomorrowStart.setDate(now.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const userQuery = isAdmin ? { userId: req.user.userId } : { $or: [{ userId: req.user.userId }, { userEmail: req.user.email }, { buddyUserId: req.user.userId }, { buddyUserEmail: req.user.email }] };
    const taskQuery = { tenantId, isDeleted: false, status: 'Pending', ...userQuery };
    const [myTasks, overdueCount, todayCount, tomorrowCount] = await Promise.all([
      UserTask.find(taskQuery).sort({ plannedAt: 1 }).limit(100).lean(),
      UserTask.countDocuments({ ...taskQuery, plannedAt: { $lt: now } }),
      UserTask.countDocuments({ ...taskQuery, plannedAt: { $gte: now, $lte: todayEnd } }),
      UserTask.countDocuments({ ...taskQuery, plannedAt: { $gte: tomorrowStart, $lte: tomorrowEnd } }),
    ]);
    const adminTaskBoard = isAdmin ? await UserTask.aggregate([
      { $match: { tenantId, isDeleted: false, status: 'Pending' } },
      { $group: { _id: { userId: '$userId', userName: '$userName', userEmail: '$userEmail' }, total: { $sum: 1 }, overdue: { $sum: { $cond: [{ $lt: ['$plannedAt', now] }, 1, 0] } }, today: { $sum: { $cond: [{ $and: [{ $gte: ['$plannedAt', now] }, { $lte: ['$plannedAt', todayEnd] }] }, 1, 0] } }, tomorrow: { $sum: { $cond: [{ $and: [{ $gte: ['$plannedAt', tomorrowStart] }, { $lte: ['$plannedAt', tomorrowEnd] }] }, 1, 0] } }, nextPlannedAt: { $min: '$plannedAt' } } },
      { $sort: { overdue: -1, today: -1, nextPlannedAt: 1 } },
      { $limit: 100 },
    ]) : [];
    const [currentFms, stockStatements, pendingRequisitions, partialPOs, urgentMaterials, vendorPerformance] = await Promise.all([
      buildCurrentFms(tenantId),
      StockStatement.find({ tenantId }).sort({ year: -1, month: -1 }).limit(3).lean(),
      Requisition.find({ tenantId, isDeleted: false, status: { $in: ['Pending', 'Partially Issued'] } }).sort({ createdAt: -1 }).limit(20).lean(),
      PurchaseOrder.find({ tenantId, isDeleted: false, status: 'Partially Received' }).sort({ updatedAt: -1 }).limit(20).lean(),
      buildUrgentMaterials(tenantId),
      buildVendorPerformance(tenantId),
    ]);

    const partialReceipts = [];
    partialPOs.forEach((po) => (po.subPOs || []).forEach((sub) => {
      if ((sub.receivedQty || 0) > 0 && (sub.balanceQty || 0) > 0) {
        partialReceipts.push({ poNo: po.poNo, subPoNo: sub.subPoNo, vendorName: sub.vendorLineName || po.vendorName, itemName: sub.itemName, orderedQty: sub.orderedQty, receivedQty: sub.receivedQty, balanceQty: sub.balanceQty, uom: sub.uom, expectedDelivery: sub.expectedDelivery, link: '/grn' });
      }
    }));

    const aiSummary = [
      urgentMaterials.length ? `${urgentMaterials.length} material(s) need ordering attention; top urgent: ${urgentMaterials[0].itemName} (${urgentMaterials[0].status}).` : 'No urgent low-stock material found from current data.',
      vendorPerformance.replace.length ? `Review/replacement suggested for: ${vendorPerformance.replace.map((v) => v.vendorName).join(', ')}.` : 'No vendor replacement warning from current receipt history.',
      partialReceipts.length ? `${partialReceipts.length} partial PO line(s) are still awaiting balance receipt.` : 'No partial receipt balance currently open.',
    ].join(' ');

    res.json({
      success: true,
      data: {
        currentFms,
        stockStatements: stockStatements.map((s) => ({ _id: s._id, monthLabel: s.monthLabel, year: s.year, month: s.month, lineCount: s.lines?.length || 0, periodStart: s.periodStart, periodEnd: s.periodEnd, generatedAt: s.generatedAt })),
        pendingRequisitions,
        partialReceipts,
        urgentMaterials,
        vendorPerformance,
        geminiAnalysis: aiSummary,
        myTasks: myTasks.map((t) => ({ ...t, timeLeftMs: t.plannedAt ? new Date(t.plannedAt).getTime() - Date.now() : null })),
        taskCounts: { overdue: overdueCount, today: todayCount, tomorrow: tomorrowCount, total: myTasks.length },
        adminTaskBoard,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDashboard };
