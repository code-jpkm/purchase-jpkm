const mongoose = require('mongoose');
const Budget = require('../models/Budget.schema');
const StoreItem = require('../models/Store-item.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const Foundry = require('../models/Foundry-dept.schema');
const User = require('../models/User.schema');
const StoreNotification = require('../models/Notification-store.schema');
const { sendEmail, sendWhatsApp, buildBudgetAlertMessage } = require('../services/notification.service');
const { getMonthLabel, getPeriodDates } = require('../utils/fiscal');

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));
const monthName = (year, month) => new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const isAdminRole = (user = {}) => ['super_admin', 'admin'].includes(user.role);
const nextMonthOf = (d = new Date()) => ({ year: d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear(), month: d.getMonth() === 11 ? 1 : d.getMonth() + 2 });
const budgetWindowStatus = (user, targetYear, targetMonth, now = new Date()) => {
  const next = nextMonthOf(now);
  const isTargetNextMonth = Number(targetYear) === next.year && Number(targetMonth) === next.month;
  const day = now.getDate();
  const inWindow = day >= 19 && day <= 27;
  const overrideOpen = user?.budgetOverrideUntil && new Date(user.budgetOverrideUntil) >= now;
  return { isTargetNextMonth, inWindow, overrideOpen, canSubmit: isAdminRole(user) || (isTargetNextMonth && inWindow) || overrideOpen, opensOnDay: 19, closesOnDay: 27, currentDay: day };
};
const scopeForBudgetUser = (user = {}) => {
  if (isAdminRole(user)) return [];
  const scopes = Array.isArray(user.departmentScopes) && user.departmentScopes.length ? user.departmentScopes : [];
  if (scopes.length) return scopes.map((s) => ({ foundry: s.foundry, department: s.department }));
  return user.foundry && user.department ? [{ foundry: user.foundry, department: user.department }] : [];
};
const canAccessBudgetDept = (user, foundry, department) => isAdminRole(user) || scopeForBudgetUser(user).some((s) => s.foundry === foundry && String(s.department).toUpperCase() === String(department).toUpperCase());


const alertRecipientsForDepartment = async (tenantId, foundry, department) => {
  const globalEmails = (process.env.BUDGET_ALERT_EMAILS || '').split(',').map((v) => v.trim()).filter(Boolean);
  const globalWa = (process.env.BUDGET_ALERT_WHATSAPP || '').split(',').map((v) => v.trim()).filter(Boolean);
  const f = await Foundry.findOne({ tenantId, name: foundry, isDeleted: { $ne: true } }).lean();
  const d = (f?.departments || []).find((x) => String(x.name).toUpperCase() === String(department).toUpperCase());
  return {
    emails: Array.from(new Set([...(d?.budgetAlertEmails || []), d?.hodEmail, ...globalEmails].filter(Boolean))),
    whatsapp: Array.from(new Set([...(d?.budgetAlertWhatsApp || []), d?.hodWhatsApp, ...globalWa].filter(Boolean))),
  };
};

const deliverBudgetAlert = async (budget, alert) => {
  const msg = alert.message || buildBudgetAlertMessage(alert.dept, alert.item, alert.budgetedVal, alert.actualVal, alert.variancePercent);
  const { emails, whatsapp } = await alertRecipientsForDepartment(budget.tenantId, budget.foundry, budget.department);
  const subject = alert.subject || `${alert.type === 'OVER' ? 'Budget Overrun' : 'Budget Warning'}: ${budget.department}`;

  await StoreNotification.create({
    tenantId: budget.tenantId,
    type: alert.type === 'OVER' ? 'BUDGET_OVERRUN' : 'BUDGET_UNDERRUN',
    title: subject,
    message: msg,
    referenceModel: 'Budget',
    referenceId: budget._id,
    referenceNo: `${budget.monthLabel} ${budget.department}`,
    priority: alert.type === 'OVER' ? 'HIGH' : 'MEDIUM',
    emailRecipients: emails,
    whatsappRecipients: whatsapp,
  });

  if (emails.length) sendEmail({ to: emails, subject, html: `<pre>${msg}</pre>` });
  if (whatsapp.length) whatsapp.forEach((p) => sendWhatsApp(p, msg));
};

const getDepartmentItems = async (tenantId, foundry, department) => {
  const query = { tenantId, isDeleted: { $ne: true }, isActive: { $ne: false }, stocks: { $elemMatch: { foundry, department } } };
  return StoreItem.find(query).sort({ itemType: 1, motherItem: 1, itemName: 1 }).lean();
};

const getBudgetTemplate = async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || (new Date().getMonth() + 1));
    const scopes = scopeForBudgetUser(req.user);
    const foundry = isAdminRole(req.user) ? (req.query.foundry || req.user.foundry || 'D. I') : (scopes[0]?.foundry || req.user.foundry);
    const department = isAdminRole(req.user) ? (req.query.department || req.user.department) : (scopes[0]?.department || req.user.department);
    if (!department) return res.status(400).json({ success: false, message: 'Department is required or user is not mapped to any department' });
    if (!canAccessBudgetDept(req.user, foundry, department)) return res.status(403).json({ success: false, message: 'You can load budget only for your assigned department' });

    const items = await getDepartmentItems(req.tenantId, foundry, department);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevBudget = await Budget.findOne({ tenantId: req.tenantId, year: prevYear, month: prevMonth, foundry, department }).lean();
    const prevBySku = new Map((prevBudget?.lines || []).map((l) => [l.skuCode, l]));

    const lines = items.map((item, idx) => {
      const stock = (item.stocks || []).find((s) => s.foundry === foundry && s.department === department) || {};
      const prev = prevBySku.get(item.skuCode) || {};
      return {
        slNo: idx + 1,
        storeItemId: item._id,
        skuCode: item.skuCode,
        foundry,
        department,
        itemName: item.itemName,
        motherItem: item.motherItem || stock.motherItem || item.itemName,
        itemType: item.itemType || 'Stores',
        uom: item.uom,
        consumptionPerKgPerMonth: prev.consumptionPerKgPerMonth || 0,
        estimatedCastingQty: 0,
        requiredQtyForMonth: 0,
        minimumOrderQty: prev.minimumOrderQty || 0,
        finalOrderQty: 0,
        tentativeOpeningStock: stock.currentQty || 0,
        rateAsPerLastPurchase: item.rate || prev.rateAsPerLastPurchase || 0,
        previousMonthQty: prev.finalOrderQty || 0,
        previousMonthValue: prev.totalValue || 0,
      };
    });

    res.json({ success: true, data: { year, month, monthLabel: monthName(year, month), foundry, department, lines } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const enrichLines = async (req, { lines, year, month, foundry, department, totalWorkingDays = 27, firstHalfDays = 13 }) => {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevBudget = await Budget.findOne({ tenantId: req.tenantId, year: prevYear, month: prevMonth, foundry, department }).lean();
  const prevBySku = new Map((prevBudget?.lines || []).map((l) => [l.skuCode, l]));

  return Promise.all((lines || []).map(async (line, idx) => {
    const item = line.skuCode ? await StoreItem.findOne({ tenantId: req.tenantId, skuCode: line.skuCode, isDeleted: { $ne: true } }).lean() : null;
    const stock = (item?.stocks || []).find((s) => s.foundry === (line.foundry || foundry) && s.department === (line.department || department)) || {};
    const prev = prevBySku.get(line.skuCode) || {};
    const consumption = Number(line.consumptionPerKgPerMonth ?? line.dailyAvgConsumption ?? 0);
    const casting = Number(line.estimatedCastingQty || 0);
    const requiredQty = Number(line.requiredQtyForMonth || consumption * casting || 0);
    const minOrder = Number(line.minimumOrderQty || 0);
    const finalQty = Number(line.finalOrderQty || Math.max(requiredQty, minOrder));
    const rate = Number(line.rateAsPerLastPurchase || item?.rate || 0);
    const totalValue = finalQty * rate;
    const firstHalfQty = Math.round((finalQty * Number(firstHalfDays || 13)) / Number(totalWorkingDays || 27));
    const secondHalfQty = finalQty - firstHalfQty;
    const prevValue = Number(prev.totalValue || 0);
    const mom = prevValue ? ((totalValue - prevValue) / prevValue) * 100 : 0;
    return {
      ...line,
      slNo: idx + 1,
      foundry: line.foundry || foundry,
      department: line.department || department,
      storeItemId: item?._id || line.storeItemId,
      skuCode: line.skuCode || item?.skuCode,
      itemName: line.itemName || item?.itemName,
      itemType: line.itemType || item?.itemType || 'Stores',
      motherItem: line.motherItem || item?.motherItem || item?.itemName || line.itemName,
      uom: line.uom || item?.uom || 'PCS',
      consumptionPerKgPerMonth: consumption,
      estimatedCastingQty: casting,
      dailyAvgConsumption: consumption,
      tentativeOpeningStock: Number(line.tentativeOpeningStock ?? stock.currentQty ?? 0),
      requiredQtyForMonth: requiredQty,
      minimumOrderQty: minOrder,
      finalOrderQty: finalQty,
      rateAsPerLastPurchase: rate,
      totalValue,
      firstHalfQty,
      firstHalfValue: firstHalfQty * rate,
      secondHalfQty,
      secondHalfValue: secondHalfQty * rate,
      previousMonthQty: prev.finalOrderQty || 0,
      previousMonthValue: prevValue,
      monthOnMonthVariancePercent: mom,
    };
  }));
};

const createBudget = async (req, res) => {
  try {
    const { year, month, foundry = req.user.foundry, department = req.user.department, lines = [], totalWorkingDays = 27 } = req.body;
    if (!year || !month || !foundry || !department) return res.status(400).json({ success: false, message: 'Year, month, foundry and department are required' });
    if (!canAccessBudgetDept(req.user, foundry, department)) return res.status(403).json({ success: false, message: 'You can submit budget only for your assigned department' });
    const window = budgetWindowStatus(req.user, year, month);
    if (!window.canSubmit) return res.status(403).json({ success: false, message: `Budget submission is closed. Users can submit only next month budget from day ${window.opensOnDay} to ${window.closesOnDay}. Admin can grant special override.` });
    const existing = await Budget.findOne({ tenantId: req.tenantId, year, month, foundry, department });
    if (existing) return res.status(400).json({ success: false, message: 'Budget for this department and month already exists' });

    const { periodStart, periodEnd } = getPeriodDates(Number(year), Number(month));
    const monthLabel = getMonthLabel(Number(year), Number(month));
    const enrichedLines = await enrichLines(req, { lines, year: Number(year), month: Number(month), foundry, department, totalWorkingDays, firstHalfDays: req.body.firstHalfDays || 13 });
    const totalBudgetValue = enrichedLines.reduce((s, l) => s + (l.totalValue || 0), 0);
    const totalPreviousMonthValue = enrichedLines.reduce((s, l) => s + (l.previousMonthValue || 0), 0);
    const highVsPreviousMonthPercent = totalPreviousMonthValue ? ((totalBudgetValue - totalPreviousMonthValue) / totalPreviousMonthValue) * 100 : 0;
    const head = await User.findOne({ tenantId: req.tenantId, foundry, department, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean();

    const budget = await Budget.create({
      tenantId: req.tenantId,
      year: Number(year),
      month: Number(month),
      monthLabel,
      foundry,
      department,
      departmentHeadUserId: head?._id,
      departmentHeadName: head?.name,
      departmentHeadEmail: head?.email,
      departmentHeadWhatsapp: head?.whatsapp,
      periodStart,
      periodEnd,
      totalWorkingDays,
      firstHalfDays: req.body.firstHalfDays || 13,
      secondHalfDays: req.body.secondHalfDays || 14,
      lines: enrichedLines,
      totalBudgetValue,
      totalPreviousMonthValue,
      highVsPreviousMonth: highVsPreviousMonthPercent > 20,
      highVsPreviousMonthPercent,
      submittedBy: req.user.userId,
      submittedAt: new Date(),
      status: 'Submitted',
    });

    if (budget.highVsPreviousMonth) {
      await deliverBudgetAlert(budget, {
        type: 'OVER',
        subject: `High monthly budget submission: ${department}`,
        message: `⚠️ *MONTHLY BUDGET INCREASE*\n\nDepartment: ${foundry} / ${department}\nMonth: ${budget.monthLabel}\nCurrent Budget: ₹${totalBudgetValue.toLocaleString('en-IN')}\nPrevious Month: ₹${totalPreviousMonthValue.toLocaleString('en-IN')}\nIncrease: ${highVsPreviousMonthPercent.toFixed(1)}%\n\nPlease review before approval.`,
      });
    }

    res.status(201).json({ success: true, data: budget });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const listBudgets = async (req, res) => {
  try {
    const { year, month, status, foundry, department } = req.query;
    const query = { tenantId: req.tenantId };
    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (status) query.status = status;
    if (foundry) query.foundry = foundry;
    if (department) query.department = department;
    if (!isAdminRole(req.user)) {
      const scopes = scopeForBudgetUser(req.user);
      if (!scopes.length) query._id = null;
      else if (scopes.length === 1) { query.foundry = scopes[0].foundry; query.department = scopes[0].department; }
      else query.$or = scopes.map((sc) => ({ foundry: sc.foundry, department: sc.department }));
    }
    const budgets = await Budget.find(query).sort({ year: -1, month: -1, department: 1 }).populate('submittedBy', 'name').lean();
    res.json({ success: true, data: budgets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate('submittedBy', 'name email').populate('approvedBy', 'name email');
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    if (!canAccessBudgetDept(req.user, budget.foundry, budget.department)) return res.status(403).json({ success: false, message: 'Access denied for this department budget' });
    res.json({ success: true, data: budget });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const runBudgetVarianceCheck = async (budget) => {
  const alerts = [];
  const RELIEF = 0.02;
  const tenantObjectId = toObjectId(budget.tenantId);
  for (const line of budget.lines) {
    if (!line.skuCode) continue;
    const pos = await PurchaseOrder.aggregate([
      { $match: { tenantId: tenantObjectId, poDate: { $gte: budget.periodStart, $lte: budget.periodEnd }, 'subPOs.skuCode': line.skuCode, status: { $nin: ['Cancelled'] }, isDeleted: false } },
      { $unwind: '$subPOs' },
      { $match: { 'subPOs.skuCode': line.skuCode, 'subPOs.foundry': line.foundry, 'subPOs.department': line.department, 'subPOs.status': { $nin: ['Cancelled'] } } },
      { $group: { _id: null, totalQty: { $sum: '$subPOs.orderedQty' }, totalValue: { $sum: '$subPOs.totalValue' } } },
    ]);
    const actual = pos[0] || { totalQty: 0, totalValue: 0 };
    line.actualQtyPurchased = actual.totalQty;
    line.actualValueSpent = actual.totalValue;
    const budgetedVal = line.totalValue || 0;
    const actualVal = actual.totalValue || 0;
    if (budgetedVal === 0) continue;
    const variancePercent = ((actualVal - budgetedVal) / budgetedVal) * 100;
    line.varianceQty = actual.totalQty - (line.finalOrderQty || 0);
    line.varianceValue = actualVal - budgetedVal;
    line.variancePercent = variancePercent;
    const isOverBudget = variancePercent > RELIEF * 100;
    const isUnderBudget = variancePercent < -RELIEF * 100;
    line.budgetStatus = isOverBudget ? 'Over Budget' : isUnderBudget ? 'Under Budget' : 'Within Budget';
    if (isOverBudget || isUnderBudget) alerts.push({ type: isOverBudget ? 'OVER' : 'UNDER', dept: line.department, item: line.itemName, skuCode: line.skuCode, budgetedVal, actualVal, variancePercent });
  }
  budget.totalActualValue = budget.lines.reduce((s, l) => s + (l.actualValueSpent || 0), 0);
  budget.markModified('lines');
  await budget.save();

  // Notifications must never make variance checking fail.
  // Earlier versions could save the variance successfully, then fail while creating/sending
  // an alert notification, causing the frontend to show "Failed to check variance".
  for (const alert of alerts) {
    try {
      await deliverBudgetAlert(budget, alert);
    } catch (err) {
      console.error('Budget variance alert delivery failed:', err.message);
      alert.notificationError = err.message;
    }
  }
  return alerts;
};

const checkBudgetVariance = async (req, res) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    const alerts = await runBudgetVarianceCheck(budget);
    res.json({ success: true, data: budget, alerts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const approveBudget = async (req, res) => {
  try {
    const budget = await Budget.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, status: 'Submitted' }, { status: 'Approved', approvedBy: req.user.userId, approvedAt: new Date() }, { new: true });
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found or not in Submitted state' });
    res.json({ success: true, data: budget });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getMasterBudget = async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || (new Date().getMonth() + 1));
    let budgetQuery = { tenantId: req.tenantId, year, month };
    if (!isAdminRole(req.user)) {
      const scopes = scopeForBudgetUser(req.user);
      if (!scopes.length) budgetQuery._id = null;
      else if (scopes.length === 1) { budgetQuery.foundry = scopes[0].foundry; budgetQuery.department = scopes[0].department; }
      else budgetQuery.$or = scopes.map((sc) => ({ foundry: sc.foundry, department: sc.department }));
    }
    const budgets = await Budget.find(budgetQuery).lean();
    const foundries = await Foundry.find({ tenantId: req.tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean();
    const requiredDepartments = [];
    foundries.forEach((f) => (f.departments || []).filter((d) => d.isActive !== false).forEach((d) => { if (isAdminRole(req.user) || canAccessBudgetDept(req.user, f.name, d.name)) requiredDepartments.push({ foundry: f.name, department: d.name, hodName: d.hodName, hodEmail: d.hodEmail }); }));
    const key = (f, d) => `${f}|${String(d).toUpperCase()}`;
    const submitted = new Map(budgets.map((b) => [key(b.foundry, b.department), b]));
    const notSubmitted = requiredDepartments.filter((d) => !submitted.has(key(d.foundry, d.department)));
    const departmentTotals = budgets.map((b) => ({ _id: b._id, foundry: b.foundry, department: b.department, status: b.status, submittedAt: b.submittedAt, submittedBy: b.submittedBy, totalBudgetValue: b.totalBudgetValue || 0, totalPreviousMonthValue: b.totalPreviousMonthValue || 0, highVsPreviousMonthPercent: b.highVsPreviousMonthPercent || 0, lineCount: b.lines?.length || 0 }));
    const allLines = budgets.flatMap((b) => (b.lines || []).map((l) => ({ ...l, budgetId: b._id, department: b.department, foundry: b.foundry })));
    const topContributors = allLines.sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0)).slice(0, 15);
    const byType = {};
    allLines.forEach((l) => { const t = l.itemType || 'Stores'; byType[t] = (byType[t] || 0) + Number(l.totalValue || 0); });
    const totalBudget = departmentTotals.reduce((s, d) => s + d.totalBudgetValue, 0);
    res.json({ success: true, data: { year, month, monthLabel: getMonthLabel(year, month), submissionWindow: budgetWindowStatus(req.user, year, month), totalBudget, totalDepartments: requiredDepartments.length, submittedCount: budgets.length, notSubmitted, departmentTotals, topContributors, byType } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const checkPOBudgetWarnings = async (tenantId, items = [], poDate = new Date()) => {
  const dt = new Date(poDate || Date.now());
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const warnings = [];
  for (const item of items) {
    if (!item.skuCode || !item.foundry || !item.department) continue;
    const budget = await Budget.findOne({ tenantId, year, month, foundry: item.foundry, department: item.department, status: { $in: ['Submitted', 'Approved', 'Locked'] } });
    if (!budget) continue;
    const line = (budget.lines || []).find((l) => l.skuCode === item.skuCode);
    if (!line || !line.totalValue) continue;
    const thisValue = Number(item.totalValue || item.taxableValue || 0);
    const existing = await PurchaseOrder.aggregate([
      { $match: { tenantId: toObjectId(tenantId), poDate: { $gte: budget.periodStart, $lte: budget.periodEnd }, status: { $nin: ['Cancelled'] }, isDeleted: false } },
      { $unwind: '$subPOs' },
      { $match: { 'subPOs.skuCode': item.skuCode, 'subPOs.foundry': item.foundry, 'subPOs.department': item.department, 'subPOs.status': { $nin: ['Cancelled'] } } },
      { $group: { _id: null, val: { $sum: '$subPOs.totalValue' } } },
    ]);
    const projected = Number(existing[0]?.val || 0) + thisValue;
    if (projected > Number(line.totalValue || 0) * 1.02) {
      warnings.push({ skuCode: item.skuCode, itemName: item.itemName, foundry: item.foundry, department: item.department, budgetValue: line.totalValue, projectedValue: projected, overBy: projected - line.totalValue });
    }
  }
  return warnings;
};

module.exports = { createBudget, listBudgets, getBudget, checkBudgetVariance, approveBudget, runBudgetVarianceCheck, getBudgetTemplate, getMasterBudget, checkPOBudgetWarnings };
