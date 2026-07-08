const mongoose = require('mongoose');
const PurchaseOrder = require('../models/Purchase-order.schema');
const Indent = require('../models/Indent.schema');
const StoreItem = require('../models/Store-item.schema');
const Vendor = require('../models/Vendor.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const { sendEmail, sendWhatsApp, buildPOAlertMessage } = require('../services/notification.service');
const { getFiscalYear } = require('../utils/fiscal');
const { completeStage, completePendingStages, formatDelay } = require('../utils/workflow');
const { buildFmsStages, syncTasksForDocument, assertCanCompleteStage } = require('../services/fms.service');
const { fetchHolidayDates } = require('../utils/business-time');

const safeAbortTransaction = async (session) => {
  if (session && typeof session.inTransaction === 'function' && session.inTransaction()) {
    await session.abortTransaction();
  }
};
const { classifyStock, getHistoricalDailyAverage } = require('../utils/inventory-health');
const { getStockEntry } = require('../utils/inventory-query');
const StoreNotification = require('../models/Notification-store.schema');
const { indianNumberToWords } = require('../utils/number-to-words');
const { generatePurchaseOrderPdfBuffer } = require('../utils/po-pdf');
const { checkPOBudgetWarnings } = require('./budget.controller');

const calculateLine = (qty, rate, discPercent, poType, cgstRate, sgstRate) => {
  const gross = Number(qty || 0) * Number(rate || 0);
  const discountAmount = gross * Number(discPercent || 0) / 100;
  const taxableValue = Math.max(0, gross - discountAmount);
  const effectiveCgstRate = poType === 'CGST_SGST' ? Number(cgstRate || 0) : 0;
  const effectiveSgstRate = Number(sgstRate || 0);
  const cgstAmount = taxableValue * effectiveCgstRate / 100;
  const sgstAmount = taxableValue * effectiveSgstRate / 100;
  const totalValue = taxableValue + cgstAmount + sgstAmount;
  return { gross, discountAmount, taxableValue, cgstAmount, sgstAmount, totalValue };
};

const getVendorForLine = async (tenantId, item, session) => {
  if (item.vendorId) return Vendor.findOne({ _id: item.vendorId, tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } }).session(session);
  if (item.vendorName) return Vendor.findOne({ tenantId, name: item.vendorName, isDeleted: { $ne: true }, isActive: { $ne: false } }).session(session);
  return null;
};

const getVendorAddressText = (vendor = {}) => {
  const address = vendor.address || {};
  return [
    vendor.name,
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].filter(Boolean).join(', ');
};

const syncPOForDisplay = (poDoc) => {
  const po = typeof poDoc.toObject === 'function' ? poDoc.toObject() : { ...poDoc };
  const stages = Array.isArray(po.workflowStages) ? po.workflowStages.map((s) => ({ ...s })) : [];
  const set = (key, actual, status = 'Yes', delay) => {
    if (!actual) return;
    const found = stages.find((s) => s.key === key);
    if (found) {
      found.actual = found.actual || actual;
      found.status = found.status === 'Pending' ? status : found.status;
      found.timeDelay = found.timeDelay || delay || formatDelay(found.planned, found.actual);
    }
  };
  set('supplier_followup_2h', po.followUp1Actual, po.followUp1Status, po.followUp1Delay);
  set('supplier_followup_7d', po.followUp2Actual, po.followUp2Status, po.followUp2Delay);
  set('supplier_followup_2d', po.followUp3Actual, po.followUp3Status, po.followUp3Delay);
  if (['Fully Received', 'Closed'].includes(po.status)) {
    const receivedAt = po.updatedAt || new Date();
    ['supplier_followup_2h', 'supplier_followup_7d', 'supplier_followup_2d'].forEach((key) => {
      const found = stages.find((s) => s.key === key);
      if (found && found.status === 'Pending') {
        found.actual = receivedAt;
        found.status = 'Yes';
        found.timeDelay = formatDelay(found.planned, receivedAt);
      }
    });
  }
  po.workflowStages = stages;
  return po;
};

// POST /api/store/purchase-orders
const createPO = async (req, res) => {
  const {
    vendorName, vendorId, isHO, items = [], remarks, poDate, vendorContact, vendorEmail, vendorWhatsapp,
    indentNo, poType = 'CGST_SGST', cgstRate = 0, sgstRate = 0,
    payTerms = '.', deliveryTerms = '', shippingMode = 'ROADWAYS', paymentMethod = 'NEFT/CHEQUE', deliveryLocation = 'KOLKATA',
  } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'At least one PO item is required' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenantId = req.tenantId;
    const effectivePoDate = new Date(poDate || Date.now());
    const poWorkflowBase = new Date(); // FMS starts when the PO is actually submitted/issued, not date-only midnight
    const fy = getFiscalYear(effectivePoDate);
    const prefix = isHO ? `POR/${fy}/H.O` : `POR/${fy}`;
    const seqType = isHO ? 'PO_HO' : 'PO';
    const poSeqNo = await StoreSequence.nextSeq(tenantId, seqType, fy, prefix);
    const poNo = `${prefix}/${poSeqNo}`;
    const qsfSeqNo = await StoreSequence.nextSeq(tenantId, 'QSF_PUR', fy, `QSF/PUR/${fy}`);
    const qsfNo = `QSF/PUR/${fy}/${String(qsfSeqNo).padStart(2, '0')}`;

    const holidays = await fetchHolidayDates(tenantId);
    const highStockWarnings = [];
    const subPOs = [];
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      if (!item.skuCode || !item.foundry || !item.department || !item.orderedQty) {
        throw new Error(`Line ${idx + 1}: SKU, foundry, department and ordered quantity are required`);
      }
      const storeItem = await StoreItem.findOne({ tenantId, skuCode: item.skuCode, isDeleted: false }).session(session);
      if (!storeItem) throw new Error(`Store item not found for SKU ${item.skuCode}`);
      const vendor = await getVendorForLine(tenantId, item, session);
      const lineVendorName = vendor?.name || item.vendorName || vendorName;
      if (!lineVendorName) throw new Error(`Line ${idx + 1}: vendor is required`);

      const subPoSeq = idx + 1;
      const subPoNo = `${poNo}/${subPoSeq}`;
      const stockEntry = getStockEntry(storeItem, item.foundry, item.department) || storeItem.stocks.find((s) => s.foundry === item.foundry && s.department === item.department);
      const histAvg = await getHistoricalDailyAverage(tenantId, item.skuCode, item.foundry, item.department, 90);
      const health = classifyStock(stockEntry || {}, histAvg);
      if (health.status === 'HIGH') {
        highStockWarnings.push(`${storeItem.itemName} (${item.skuCode}) already has HIGH stock: ${health.currentQty} ${storeItem.uom}; recommended max ${health.maxLevel || stockEntry?.maxLevel || 0}`);
      }
      const leadTimeDays = Number(item.leadTimeDays || stockEntry?.leadTime || vendor?.avgLeadTimeDays || 7);
      const expectedDelivery = require('../utils/business-time').addTatDays(effectivePoDate, leadTimeDays, holidays);
      const rate = Number(item.rate || storeItem.rate || 0);
      const discPercent = Number(item.discPercent || 0);
      const lineCalc = calculateLine(item.orderedQty, rate, discPercent, poType, cgstRate, sgstRate);

      if (item.indentId) {
        await Indent.findOneAndUpdate(
          { _id: item.indentId, tenantId, status: { $in: ['Submitted', 'Acknowledged'] } },
          { status: 'PO Created', purchaseOrderId: null, poNo, poActual: new Date(), poStatus: 'Yes' },
          { session }
        );
      }

      subPOs.push({
        subPoNo,
        subPoSeq,
        indentId: item.indentId,
        indentNo: item.indentNo || indentNo,
        vendorLineId: vendor?._id || item.vendorId || undefined,
        vendorLineName: lineVendorName,
        skuCode: item.skuCode,
        storeItemId: storeItem._id,
        hsnCode: item.hsnCode || storeItem.hsnCode,
        foundry: item.foundry,
        department: item.department,
        itemName: item.itemName || storeItem.itemName,
        uom: item.uom || storeItem.uom,
        orderedQty: Number(item.orderedQty || 0),
        balanceQty: Number(item.orderedQty || 0),
        rate,
        discPercent,
        discountAmount: lineCalc.discountAmount,
        taxableValue: lineCalc.taxableValue,
        cgstRate: poType === 'CGST_SGST' ? Number(cgstRate || 0) : 0,
        sgstRate: Number(sgstRate || 0),
        cgstAmount: lineCalc.cgstAmount,
        sgstAmount: lineCalc.sgstAmount,
        totalValue: lineCalc.totalValue,
        subtotalValue: lineCalc.taxableValue,
        discountTotal: lineCalc.discountAmount,
        cgstTotal: lineCalc.cgstAmount,
        sgstTotal: lineCalc.sgstAmount,
        leadTimeDays,
        expectedDelivery,
        status: 'Open',
      });
    }

    const firstVendor = await getVendorForLine(tenantId, { vendorId: vendorId || subPOs[0].vendorLineId, vendorName: vendorName || subPOs[0].vendorLineName }, session);
    const resolvedVendorName = firstVendor?.name || vendorName || subPOs[0].vendorLineName || 'Multiple Vendors';
    const budgetWarnings = await checkPOBudgetWarnings(tenantId, subPOs, effectivePoDate);
    const subtotalValue = subPOs.reduce((s, sp) => s + (sp.taxableValue || 0), 0);
    const discountTotal = subPOs.reduce((s, sp) => s + (sp.discountAmount || 0), 0);
    const cgstTotal = subPOs.reduce((s, sp) => s + (sp.cgstAmount || 0), 0);
    const sgstTotal = subPOs.reduce((s, sp) => s + (sp.sgstAmount || 0), 0);
    const totalValue = subPOs.reduce((s, sp) => s + (sp.totalValue || 0), 0);
    const earliestDelivery = new Date(Math.min(...subPOs.map((s) => new Date(s.expectedDelivery).getTime())));
    const workflowStages = await buildFmsStages(tenantId, 'po', poWorkflowBase, holidays, { earliestDelivery });

    const [po] = await PurchaseOrder.create([
      {
        tenantId,
        prefix,
        poSeqNo,
        poNo,
        qsfNo,
        isHO: !!isHO,
        poDate: effectivePoDate,
        vendorId: firstVendor?._id || vendorId || undefined,
        vendorName: resolvedVendorName,
        vendorContact: firstVendor?.phone || vendorContact,
        vendorKindAttention: firstVendor?.kindAttention || firstVendor?.contactPerson || '',
        vendorPhone: firstVendor?.phone || vendorContact || '',
        vendorGstin: firstVendor?.gstNo || '',
        vendorAddressText: getVendorAddressText(firstVendor || {}),
        vendorEmail: firstVendor?.email || vendorEmail,
        vendorWhatsapp: firstVendor?.whatsapp || vendorWhatsapp,
        createdBy: req.user.userId,
        createdByName: req.user.name,
        poType,
        cgstRate: poType === 'CGST_SGST' ? Number(cgstRate || 0) : 0,
        sgstRate: Number(sgstRate || 0),
        payTerms,
        deliveryTerms,
        shippingMode,
        paymentMethod,
        deliveryLocation,
        amountInWords: indianNumberToWords(totalValue),
        workflowStages,
        followUp1Planned: workflowStages[0].planned,
        followUp2Planned: workflowStages[1].planned,
        followUp3Planned: workflowStages[2].planned,
        subPOs,
        totalItems: subPOs.length,
        subtotalValue,
        discountTotal,
        cgstTotal,
        sgstTotal,
        totalValue,
        status: 'Issued',
        remarks,
      },
    ], { session });

    for (const sp of subPOs) {
      if (sp.indentId) {
        const ind = await Indent.findOne({ _id: sp.indentId, tenantId }).session(session);
        const stages = ind ? completeStage(ind.workflowStages, 'quote_po', new Date(), 'Yes', 'indent', holidays, ind.createdAt || ind.indentDate || new Date()) : undefined;
        await Indent.findOneAndUpdate(
          { _id: sp.indentId, tenantId },
          { purchaseOrderId: po._id, poNo, status: 'PO Created', poActual: new Date(), poStatus: 'Yes', ...(stages ? { workflowStages: stages } : {}) },
          { session }
        );
      }
    }

    await session.commitTransaction();

    try {
      await syncTasksForDocument({ tenantId, fmsType: 'po', doc: po, referenceNo: po.poNo, link: '/purchase-orders' });
      const linkedIndents = await Indent.find({ tenantId, poNo }).limit(200);
      for (const doc of linkedIndents) await syncTasksForDocument({ tenantId, fmsType: 'indent', doc, referenceNo: doc.indentNo, link: '/indents' });

      const alertMsg = buildPOAlertMessage(poNo, resolvedVendorName, subPOs.length, totalValue);
      if (process.env.PURCHASE_ALERT_EMAILS) sendEmail({ to: process.env.PURCHASE_ALERT_EMAILS.split(','), subject: `PO Issued: ${poNo}`, html: `<pre>${alertMsg}</pre>` });
      if (process.env.PURCHASE_ALERT_WHATSAPP) process.env.PURCHASE_ALERT_WHATSAPP.split(',').forEach((p) => sendWhatsApp(p.trim(), alertMsg));
      if (budgetWarnings.length) {
        const warnMsg = `🚨 *BUDGET EXCEEDING WARNING*\n\nPO No: ${poNo}\n${budgetWarnings.map((w, i) => `${i + 1}. ${w.itemName} (${w.skuCode}) in ${w.foundry}/${w.department}: budget ₹${Number(w.budgetValue || 0).toLocaleString('en-IN')}, projected ₹${Number(w.projectedValue || 0).toLocaleString('en-IN')} (over by ₹${Number(w.overBy || 0).toLocaleString('en-IN')}`).join('\n')}\n\nApproval should re-check this warning.\n\n_JPK Store System_`;
        await StoreNotification.create({ tenantId, type: 'BUDGET_PO_WARNING', title: `Budget warning: ${poNo}`, message: warnMsg, referenceModel: 'PurchaseOrder', referenceId: po._id, referenceNo: poNo, priority: 'HIGH' });
        if (process.env.BUDGET_ALERT_EMAILS) sendEmail({ to: process.env.BUDGET_ALERT_EMAILS.split(','), subject: `Budget warning for ${poNo}`, html: `<pre>${warnMsg}</pre>` });
        if (process.env.BUDGET_ALERT_WHATSAPP) process.env.BUDGET_ALERT_WHATSAPP.split(',').forEach((p) => sendWhatsApp(p.trim(), warnMsg));
      }
      if (highStockWarnings.length) {
        const warnMsg = `⚠️ *HIGH STOCK PO WARNING*\n\nPO No: ${poNo}\n${highStockWarnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nPlease verify before ordering.\n\n_JPK Store System_`;
        await StoreNotification.create({ tenantId, type: 'HIGH_STOCK_PO_WARNING', title: `High stock warning: ${poNo}`, message: warnMsg, referenceModel: 'PurchaseOrder', referenceId: po._id, referenceNo: poNo, priority: 'HIGH' });
        if (process.env.PURCHASE_ALERT_EMAILS) sendEmail({ to: process.env.PURCHASE_ALERT_EMAILS.split(','), subject: `High stock warning for ${poNo}`, html: `<pre>${warnMsg}</pre>` });
        if (process.env.PURCHASE_ALERT_WHATSAPP) process.env.PURCHASE_ALERT_WHATSAPP.split(',').forEach((p) => sendWhatsApp(p.trim(), warnMsg));
      }
      if (po.vendorEmail) sendEmail({ to: po.vendorEmail, subject: `Purchase Order ${poNo} from JPK Factory`, html: `<p>Dear ${resolvedVendorName},</p><p>Please find PO <strong>${poNo}</strong>.</p><p>Total Items: ${subPOs.length} | Total Value: ₹${totalValue.toLocaleString('en-IN')}</p><p>Regards,<br/>JPK Factory Purchase Team</p>` });
    } catch (postCommitErr) {
      console.error('PO created, but post-commit notification/task sync failed:', postCommitErr);
    }

    res.status(201).json({ success: true, data: po, warnings: [...highStockWarnings, ...budgetWarnings.map((w) => `Budget warning: ${w.itemName} projected over budget by ₹${Number(w.overBy || 0).toLocaleString('en-IN')}`)] });
  } catch (err) {
    await safeAbortTransaction(session);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/store/purchase-orders
const listPOs = async (req, res) => {
  try {
    const { status, search, from, to, openOnly, page = 1, limit = 30 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false };
    if (status) query.status = status;
    if (openOnly === 'true') query.status = { $in: ['Issued', 'Partially Received'] };
    if (search) {
      query.$or = [
        { poNo: { $regex: search, $options: 'i' } },
        { vendorName: { $regex: search, $options: 'i' } },
        { 'subPOs.itemName': { $regex: search, $options: 'i' } },
        { 'subPOs.skuCode': { $regex: search, $options: 'i' } },
      ];
    }
    if (from || to) {
      query.poDate = {};
      if (from) query.poDate.$gte = new Date(from);
      if (to) query.poDate.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(query).sort({ poDate: -1 }).skip(skip).limit(parseInt(limit)).populate('vendorId', 'name email phone gstNo address contactPerson whatsapp'),
      PurchaseOrder.countDocuments(query),
    ]);
    res.json({ success: true, data: pos.map(syncPOForDisplay), total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/purchase-orders/:id
const getPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('vendorId')
      .populate('createdBy', 'name email');
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    res.json({ success: true, data: syncPOForDisplay(po) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/purchase-orders/:id/pdf
const downloadPOPDF = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate('vendorId');
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    const buffer = generatePurchaseOrderPdfBuffer(po.toObject(), po.vendorId || {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${po.poNo.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/store/purchase-orders/:id/followup
const recordFollowUp = async (req, res) => {
  try {
    const { stage } = req.body; // 1, 2, or 3
    const now = new Date();
    const holidays = await fetchHolidayDates(req.tenantId);
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    po[`followUp${stage}Actual`] = now;
    po[`followUp${stage}Status`] = 'Yes';
    po[`followUp${stage}Delay`] = formatDelay(po[`followUp${stage}Planned`], now);
    const stageKey = stage === 1 ? 'supplier_followup_2h' : stage === 2 ? 'supplier_followup_7d' : 'supplier_followup_2d';
    assertCanCompleteStage(po.workflowStages, stageKey, req.user);
    po.workflowStages = completeStage(po.workflowStages, stageKey, now, 'Yes', 'po', holidays, po.createdAt || po.poDate || now);
    const st1 = po.workflowStages.find((s) => s.key === 'supplier_followup_2h');
    const st2 = po.workflowStages.find((s) => s.key === 'supplier_followup_7d');
    const st3 = po.workflowStages.find((s) => s.key === 'supplier_followup_2d');
    if (st1) po.followUp1Planned = st1.planned;
    if (st2) po.followUp2Planned = st2.planned;
    if (st3) po.followUp3Planned = st3.planned;
    await po.save();
    await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'po', doc: po, referenceNo: po.poNo, link: '/purchase-orders' });
    res.json({ success: true, data: syncPOForDisplay(po) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/store/purchase-orders/:id/cancel
const cancelPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, status: { $in: ['Draft', 'Issued'] } },
      { status: 'Cancelled', remarks: req.body.remarks },
      { new: true }
    );
    if (!po) return res.status(400).json({ success: false, message: 'Cannot cancel PO in current status' });

    for (const sp of po.subPOs) {
      if (sp.indentId) {
        await Indent.findOneAndUpdate({ _id: sp.indentId, tenantId: req.tenantId }, { status: 'Acknowledged', purchaseOrderId: null, poNo: null });
      }
    }
    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/purchase-orders/last-purchase/:skuCode — get last purchase info for item
const getLastPurchaseInfo = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne(
      { tenantId: req.tenantId, 'subPOs.skuCode': req.params.skuCode, status: { $ne: 'Cancelled' } },
      { poNo: 1, poDate: 1, vendorName: 1, vendorId: 1, 'subPOs.$': 1 }
    ).sort({ poDate: -1 });

    if (!po) return res.json({ success: true, data: null });

    const sub = po.subPOs[0];
    res.json({
      success: true,
      data: {
        lastPoNo: po.poNo,
        lastPoDate: po.poDate,
        lastVendorName: sub?.vendorLineName || po.vendorName,
        lastVendorId: sub?.vendorLineId || po.vendorId,
        lastRate: sub?.rate || 0,
        lastQty: sub?.orderedQty || 0,
        lastDiscPercent: sub?.discPercent || 0,
        leadTimeDays: sub?.leadTimeDays || 7,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createPO, listPOs, getPO, downloadPOPDF, recordFollowUp, cancelPO, getLastPurchaseInfo };
