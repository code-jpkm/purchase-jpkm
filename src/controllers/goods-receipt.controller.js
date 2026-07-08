const mongoose = require('mongoose');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const Indent = require('../models/Indent.schema');
const StoreItem = require('../models/Store-item.schema');
const StoreNotification = require('../models/Notification-store.schema');
const { addStock, deductStock } = require('../services/stock.service');
const { sendEmail, sendWhatsApp, buildGRNMessage } = require('../services/notification.service');
const StoreSequence = require('../models/Store-sequence.schema');
const { completeStage, setStageStatus, completePendingStages, closePendingAfterStage, formatDelay } = require('../utils/workflow');
const { buildFmsStages, syncTasksForDocument, assertCanCompleteStage } = require('../services/fms.service');
const { fetchHolidayDates } = require('../utils/business-time');
const { generateNotePdfBuffer } = require('../utils/note-pdf');

const safeAbortTransaction = async (session) => {
  if (session && typeof session.inTransaction === 'function' && session.inTransaction()) {
    await session.abortTransaction();
  }
};


const updatePOStatus = (po) => {
  const subs = po.subPOs || [];
  const nonCancelled = subs.filter((s) => s.status !== 'Cancelled');
  const anyReturned = subs.some((s) => ['Returned', 'Partially Returned'].includes(s.status) || Number(s.returnedQty || 0) > 0);
  const allReturned = nonCancelled.length > 0 && nonCancelled.every((s) => s.status === 'Returned');
  const allFull = nonCancelled.length > 0 && nonCancelled.every((s) => s.status === 'Fully Received');
  const anyReceived = subs.some((s) => (s.receivedQty || 0) > 0);
  if (allFull) po.status = 'Fully Received';
  else if (allReturned) po.status = 'Returned';
  else if (anyReturned) po.status = 'Partially Returned';
  else if (anyReceived) po.status = 'Partially Received';
  else po.status = 'Issued';
};


const syncPOWorkflowOnReceipt = (po, actualDate = new Date(), holidays = []) => {
  if (!po || !Array.isArray(po.workflowStages)) return;
  po.workflowStages = completePendingStages(po.workflowStages, ['supplier_followup_2h'], actualDate, 'po', holidays, po.createdAt || po.poDate || actualDate);
  if (po.status === 'Fully Received') {
    po.workflowStages = completePendingStages(po.workflowStages, ['supplier_followup_2h', 'supplier_followup_7d', 'supplier_followup_2d'], actualDate);
    po.workflowStages.forEach((stage) => {
      if (stage.status === 'Yes') {
        if (stage.key === 'supplier_followup_2h' && !po.followUp1Actual) { po.followUp1Actual = stage.actual; po.followUp1Status = 'Yes'; po.followUp1Delay = stage.timeDelay; }
        if (stage.key === 'supplier_followup_7d' && !po.followUp2Actual) { po.followUp2Actual = stage.actual; po.followUp2Status = 'Yes'; po.followUp2Delay = stage.timeDelay; }
        if (stage.key === 'supplier_followup_2d' && !po.followUp3Actual) { po.followUp3Actual = stage.actual; po.followUp3Status = 'Yes'; po.followUp3Delay = stage.timeDelay; }
      }
    });
  }
};

const syncGRNForDisplay = (grnDoc) => {
  const grn = typeof grnDoc.toObject === 'function' ? grnDoc.toObject() : { ...grnDoc };
  let stages = Array.isArray(grn.workflowStages) ? grn.workflowStages.map((s) => ({ ...s })) : [];
  const apply = (key, actual, status = 'Yes') => {
    if (!actual) return;
    const found = stages.find((s) => s.key === key);
    if (found) {
      found.actual = found.actual || actual;
      found.status = found.status === 'Pending' ? status : found.status;
      found.timeDelay = found.timeDelay || formatDelay(found.planned, found.actual);
    }
  };
  apply('receive_material', grn.gateChecklistAt || grn.actualReceiptDate, 'Yes');
  apply('quality_quantity_check', grn.qqCheckActual, grn.qqCheckStatus === 'Failed' ? 'No' : 'Yes');
  apply('store_material', grn.storeActual || grn.stockAddedAt, grn.stockAdded ? 'Yes' : 'Pending');
  apply('return_material', grn.returnedAt, grn.materialReturned ? 'Yes' : 'Pending');
  apply('invoice_to_ho', grn.invoiceSentToHOActual, 'Yes');
  apply('accounts_process', grn.accountsActual, 'Yes');
  grn.workflowStages = stages;
  return grn;
};

const updateIndentFromSubPO = async (tenantId, sub, session) => {
  if (!sub.indentId) return;
  let status = 'PO Created';
  if (sub.status === 'Returned' || Number(sub.returnedQty || 0) >= Number(sub.receivedQty || 0)) status = 'Returned';
  else if (sub.status === 'Partially Returned' || Number(sub.returnedQty || 0) > 0) status = 'Partially Returned';
  else if ((sub.balanceQty || 0) <= 0) status = 'Fully Received';
  else if ((sub.receivedQty || 0) > 0) status = 'Partially Received';
  await Indent.findOneAndUpdate({ _id: sub.indentId, tenantId }, { status }, { session });
};

const buildReceiptLines = (body) => {
  if (Array.isArray(body.items) && body.items.length) return body.items.map((line) => ({ ...body, ...line }));
  return [body];
};

// POST /api/store/grn — create one or many item-wise receipts from a PO
const createGRN = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenantId = req.tenantId;
    const lines = buildReceiptLines(req.body);
    const created = [];
    const holidays = await fetchHolidayDates(tenantId);
    let touchedPO = null;

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const {
        poNo, subPoNo, vendorName, vendorId, skuCode, foundry, department,
        itemDescription, uom, secondaryUom, orderedQty, receivedQty,
        expectedDeliveryDate, actualReceiptDate, invoiceNo, challanNo, invoiceDate, rate, invoiceBillQty, physicalReceivedQty,
      } = line;
      const billQty = Number(invoiceBillQty ?? receivedQty ?? 0);
      const qtyReceived = Number(physicalReceivedQty ?? receivedQty ?? invoiceBillQty ?? 0);
      if (!poNo || !subPoNo || !skuCode || !foundry || !department || qtyReceived <= 0) {
        throw new Error(`Line ${idx + 1}: PO, Sub-PO, SKU, location and received quantity are required`);
      }

      const po = await PurchaseOrder.findOne({ tenantId, poNo }).session(session);
      if (!po) throw new Error(`Line ${idx + 1}: PO not found`);

      const sub = po.subPOs.find((s) => s.subPoNo === subPoNo);
      if (!sub) throw new Error(`Line ${idx + 1}: Sub-PO not found`);

      const storeItem = await StoreItem.findOne({ tenantId, skuCode, isDeleted: false }).session(session);
      if (!storeItem) throw new Error(`Line ${idx + 1}: Store item not found for this SKU`);

      const previousBalance = sub.balanceQty ?? sub.orderedQty;
      const excessQty = Math.max(0, qtyReceived - previousBalance);
      const balanceQty = Math.max(0, previousBalance - qtyReceived);
      const shortExcessQty = qtyReceived - billQty;
      let noteType = 'None';
      let noteNo = '';
      let noteQty = Math.abs(shortExcessQty);
      const effectiveRatePreview = Number(rate || sub.rate || 0);
      if (shortExcessQty < 0) { noteType = 'Debit Note'; noteNo = `DN/${Date.now()}/${idx + 1}`; }
      if (shortExcessQty > 0) { noteType = 'Credit Note'; noteNo = `CN/${Date.now()}/${idx + 1}`; }

      const expectedDate = expectedDeliveryDate ? new Date(expectedDeliveryDate) : sub.expectedDelivery || null;
      const actualDate = (!actualReceiptDate || String(actualReceiptDate) === new Date().toISOString().split('T')[0]) ? new Date() : new Date(actualReceiptDate);
      let deliveryStatus = 'NO DELAY';
      let deliveryDelayDays = 0;
      if (expectedDate) {
        const diffMs = actualDate - expectedDate;
        deliveryDelayDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (deliveryDelayDays > 0) deliveryStatus = 'Delayed';
        else if (deliveryDelayDays < 0) deliveryStatus = 'Early';
      }

      let workflowStages = await buildFmsStages(tenantId, 'grn', actualDate, holidays);
      workflowStages = completeStage(workflowStages, 'receive_material', actualDate, 'Yes', 'grn', holidays, actualDate);
      const qqPlanned = workflowStages.find((st) => st.key === 'quality_quantity_check')?.planned;
      const storePlanned = workflowStages.find((st) => st.key === 'store_material')?.planned;
      const invoiceSendPlanned = workflowStages.find((st) => st.key === 'invoice_to_ho')?.planned;
      const effectiveRate = Number(rate || sub.rate || 0);

      const [grn] = await GoodsReceipt.create([
        {
          tenantId,
          purchaseOrderId: po._id,
          poNo,
          subPOId: sub._id,
          subPoNo,
          vendorId: vendorId || po.vendorId || sub.vendorLineId,
          vendorName: vendorName || sub.vendorLineName || po.vendorName,
          skuCode,
          storeItemId: storeItem._id,
          foundry,
          department,
          itemDescription: itemDescription || sub.itemName || storeItem.itemName,
          uom: uom || sub.uom || storeItem.uom,
          secondaryUom,
          orderedQty: orderedQty || sub.orderedQty,
          receivedQty: qtyReceived,
          invoiceBillQty: billQty,
          physicalReceivedQty: qtyReceived,
          shortExcessQty,
          noteType,
          noteNo,
          noteQty,
          noteValue: noteQty * effectiveRatePreview,
          balanceQty,
          excessQty,
          expectedDeliveryDate: expectedDate,
          actualReceiptDate: actualDate,
          deliveryStatus,
          deliveryDelayDays,
          workflowStages,
          gateChecklistDone: true,
          gateChecklistAt: actualDate,
          qqCheckPlanned: qqPlanned,
          storePlanned,
          invoiceSentToHOPlanned: invoiceSendPlanned,
          invoiceNo,
          challanNo,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
          rate: effectiveRate,
          totalValue: qtyReceived * effectiveRate,
          receivedBy: req.user.userId,
          receivedByName: req.user.name,
          status: 'Pending QC',
        },
      ], { session });

      sub.receivedQty = (sub.receivedQty || 0) + qtyReceived;
      sub.balanceQty = balanceQty;
      sub.excessQty = (sub.excessQty || 0) + excessQty;
      sub.status = balanceQty === 0 ? 'Fully Received' : 'Partially Received';
      updatePOStatus(po);
      syncPOWorkflowOnReceipt(po, actualDate, holidays);
      await po.save({ session });
      touchedPO = po;
      await updateIndentFromSubPO(tenantId, sub, session);
      created.push(grn);
    }

    await session.commitTransaction();

    try {
      for (const doc of created) await syncTasksForDocument({ tenantId, fmsType: 'grn', doc, referenceNo: doc.poNo, link: '/grn' });
      if (touchedPO) await syncTasksForDocument({ tenantId, fmsType: 'po', doc: touchedPO, referenceNo: touchedPO.poNo, link: '/purchase-orders' });

      for (const grn of created) {
        if (grn.noteType && grn.noteType !== 'None') {
          const noteMsg = `${grn.noteType === 'Debit Note' ? '🧾 DEBIT NOTE' : '🧾 CREDIT NOTE'} GENERATED\n\nVendor: ${grn.vendorName}\nPO: ${grn.poNo}\nItem: ${grn.itemDescription}\nInvoice Qty: ${grn.invoiceBillQty} ${grn.uom}\nPhysical Received: ${grn.physicalReceivedQty} ${grn.uom}\nDifference: ${grn.shortExcessQty} ${grn.uom}\nNote No: ${grn.noteNo}\nValue: ₹${Number(grn.noteValue || 0).toLocaleString('en-IN')}`;
          await StoreNotification.create({ tenantId, type: grn.noteType === 'Debit Note' ? 'DEBIT_NOTE' : 'CREDIT_NOTE', title: `${grn.noteType}: ${grn.itemDescription}`, message: noteMsg, referenceModel: 'GoodsReceipt', referenceId: grn._id, referenceNo: grn.poNo, priority: 'HIGH' });
          if (process.env.ACCOUNTS_ALERT_EMAILS || process.env.BUDGET_ALERT_EMAILS) sendEmail({ to: (process.env.ACCOUNTS_ALERT_EMAILS || process.env.BUDGET_ALERT_EMAILS).split(','), subject: `${grn.noteType} generated - ${grn.poNo}`, html: `<pre>${noteMsg}</pre>` });
        }
        const msg = buildGRNMessage(grn.poNo, grn.itemDescription, grn.receivedQty, grn.uom);
        if (process.env.STORE_MANAGER_EMAIL) sendEmail({ to: process.env.STORE_MANAGER_EMAIL, subject: `GRN: Material Received - ${grn.poNo}`, html: `<pre>${msg}</pre>` });
        if (process.env.STORE_MANAGER_WHATSAPP) sendWhatsApp(process.env.STORE_MANAGER_WHATSAPP, msg);
      }
    } catch (postCommitErr) {
      console.error('GRN created, but post-commit notification/task sync failed:', postCommitErr);
    }

    res.status(201).json({ success: true, data: created.length === 1 ? created[0] : created });
  } catch (err) {
    await safeAbortTransaction(session);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// PATCH /api/store/grn/:id/qc — QC pass/fail, including partial return before stocking
const processQC = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { passed, reason, returnQty } = req.body;
    const now = new Date();
    const holidays = await fetchHolidayDates(req.tenantId);

    const grn = await GoodsReceipt.findOne({ _id: req.params.id, tenantId: req.tenantId }).session(session);
    if (!grn) {
      await safeAbortTransaction(session);
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }
    if (grn.qqCheckStatus !== 'Pending') {
      await safeAbortTransaction(session);
      return res.status(400).json({ success: false, message: 'QC already processed for this GRN' });
    }

    const po = await PurchaseOrder.findById(grn.purchaseOrderId).session(session);
    const sub = po?.subPOs.find((s) => String(s._id) === String(grn.subPOId));
    const rejectedQty = passed ? 0 : Math.min(Number(returnQty || grn.receivedQty), grn.receivedQty);
    const acceptedQty = grn.receivedQty - rejectedQty;

    assertCanCompleteStage(grn.workflowStages, 'quality_quantity_check', req.user);
    grn.qqCheckActual = now;
    grn.qqCheckPassed = !!passed;
    grn.qqCheckStatus = passed ? 'Passed' : 'Failed';
    grn.qqCheckDelay = formatDelay(grn.qqCheckPlanned, now);
    grn.workflowStages = completeStage(grn.workflowStages, 'quality_quantity_check', now, passed ? 'Yes' : 'No', 'grn', holidays, grn.actualReceiptDate || now);

    if (acceptedQty > 0) {
      await addStock(req.tenantId, grn.skuCode, grn.foundry, grn.department, acceptedQty, session);
      grn.stockAdded = true;
      grn.stockAddedAt = now;
      grn.storeActual = now;
      grn.storeStatus = 'Yes';
      grn.workflowStages = completeStage(grn.workflowStages, 'store_material', now, 'Yes', 'grn', holidays, grn.actualReceiptDate || now);
      grn.status = rejectedQty > 0 ? 'Partially Returned' : 'Stocked';
    }

    if (rejectedQty === 0) {
      grn.workflowStages = setStageStatus(grn.workflowStages, 'return_material', 'No', null, 'grn', holidays, grn.actualReceiptDate || now);
    }

    if (rejectedQty > 0) {
      grn.materialReturned = true;
      grn.returnedAt = now;
      grn.returnReason = reason;
      grn.returnedQtyPartial = rejectedQty;
      grn.returnedQty = (grn.returnedQty || 0) + rejectedQty;
      assertCanCompleteStage(grn.workflowStages, 'return_material', req.user);
    grn.workflowStages = completeStage(grn.workflowStages, 'return_material', now, 'Yes', 'grn', holidays, grn.actualReceiptDate || now);
      grn.workflowStages = closePendingAfterStage(grn.workflowStages, 'return_material', 'Skipped', now, 'grn', holidays, grn.actualReceiptDate || now);
      if (acceptedQty === 0) {
        grn.status = 'Returned';
        grn.workflowStages = setStageStatus(grn.workflowStages, 'store_material', 'No', null, 'grn', holidays, grn.actualReceiptDate || now);
      }

      if (sub) {
        sub.returnedQty = (sub.returnedQty || 0) + rejectedQty;
        sub.balanceQty = (sub.balanceQty || 0) + rejectedQty;
        sub.status = rejectedQty >= grn.receivedQty ? 'Returned' : 'Partially Returned';
      }

      const failMsg = `❌ *QC FAILED*\n\nPO No: ${grn.poNo}\nItem: ${grn.itemDescription}\nVendor: ${grn.vendorName}\nRejected Qty: ${rejectedQty} ${grn.uom}\nReason: ${reason || 'Not specified'}\n\nMaterial being returned.\n\n_JPK Store System_`;
      await StoreNotification.create({
        tenantId: req.tenantId,
        type: 'QC_FAILED',
        title: `QC Failed: ${grn.itemDescription}`,
        message: failMsg,
        referenceModel: 'GoodsReceipt',
        referenceId: grn._id,
        referenceNo: grn.poNo,
        priority: 'HIGH',
      });
      const purchaseWa = process.env.PURCHASE_ALERT_WHATSAPP;
      if (purchaseWa) purchaseWa.split(',').forEach((p) => sendWhatsApp(p.trim(), failMsg));
    }

    if (po) {
      updatePOStatus(po);
      await po.save({ session });
      touchedPO = po;
      if (sub) await updateIndentFromSubPO(req.tenantId, sub, session);
    }

    if (acceptedQty > 0) {
      await StoreItem.findOneAndUpdate(
        { tenantId: req.tenantId, skuCode: grn.skuCode },
        { rate: grn.rate || 0, lastVendorName: grn.vendorName, lastVendorId: grn.vendorId, lastPurchaseDate: grn.actualReceiptDate },
        { session }
      );
    }

    await grn.save({ session });
    await session.commitTransaction();

    try {
      await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'grn', doc: grn, referenceNo: grn.poNo, link: '/grn' });
      if (po) await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'po', doc: po, referenceNo: po.poNo, link: '/purchase-orders' });
    } catch (postCommitErr) {
      console.error('QC saved, but post-commit task sync failed:', postCommitErr);
    }

    res.json({ success: true, data: syncGRNForDisplay(grn) });
  } catch (err) {
    await safeAbortTransaction(session);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// PATCH /api/store/grn/:id/return — return material after it was stocked, even months later
const returnMaterial = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { qty, reason } = req.body;
    const returnQty = Number(qty || 0);
    if (returnQty <= 0) {
      await safeAbortTransaction(session);
      return res.status(400).json({ success: false, message: 'Return quantity must be greater than zero' });
    }

    const grn = await GoodsReceipt.findOne({ _id: req.params.id, tenantId: req.tenantId }).session(session);
    if (!grn) {
      await safeAbortTransaction(session);
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }
    if (!grn.stockAdded) {
      await safeAbortTransaction(session);
      return res.status(400).json({ success: false, message: 'Material is not stocked yet' });
    }
    const alreadyReturned = grn.returnedQty || 0;
    if (returnQty > grn.receivedQty - alreadyReturned) {
      await safeAbortTransaction(session);
      return res.status(400).json({ success: false, message: 'Return quantity exceeds available received quantity' });
    }

    assertCanCompleteStage(grn.workflowStages, 'return_material', req.user);
    await deductStock(req.tenantId, grn.skuCode, grn.foundry, grn.department, returnQty, session);

    const now = new Date();
    grn.materialReturned = true;
    grn.returnedAt = now;
    grn.returnReason = reason;
    grn.returnedQty = (grn.returnedQty || 0) + returnQty;
    grn.status = grn.returnedQty >= grn.receivedQty ? 'Returned' : 'Partially Returned';
    const holidays = await fetchHolidayDates(req.tenantId);
    grn.workflowStages = completeStage(grn.workflowStages, 'return_material', now, 'Yes', 'grn', holidays, grn.actualReceiptDate || now);
    grn.workflowStages = closePendingAfterStage(grn.workflowStages, 'return_material', 'Skipped', now, 'grn', holidays, grn.actualReceiptDate || now);

    const po = await PurchaseOrder.findById(grn.purchaseOrderId).session(session);
    const sub = po?.subPOs.find((s) => String(s._id) === String(grn.subPOId));
    if (sub) {
      sub.returnedQty = (sub.returnedQty || 0) + returnQty;
      sub.balanceQty = (sub.balanceQty || 0) + returnQty;
      sub.status = grn.returnedQty >= grn.receivedQty ? 'Returned' : 'Partially Returned';
      updatePOStatus(po);
      await po.save({ session });
      touchedPO = po;
      await updateIndentFromSubPO(req.tenantId, sub, session);
    }

    const msg = `↩️ *MATERIAL RETURNED*\n\nPO No: ${grn.poNo}\nItem: ${grn.itemDescription}\nQty: ${returnQty} ${grn.uom}\nReason: ${reason || 'Not specified'}\n\n_JPK Store System_`;
    await StoreNotification.create({
      tenantId: req.tenantId,
      type: 'RETURN_MATERIAL',
      title: `Material Returned: ${grn.itemDescription}`,
      message: msg,
      referenceModel: 'GoodsReceipt',
      referenceId: grn._id,
      referenceNo: grn.poNo,
      priority: 'HIGH',
    });

    await grn.save({ session });
    await session.commitTransaction();
    try {
      await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'grn', doc: grn, referenceNo: grn.poNo, link: '/grn' });
      if (po) await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'po', doc: po, referenceNo: po.poNo, link: '/purchase-orders' });
    } catch (postCommitErr) {
      console.error('Return saved, but post-commit task sync failed:', postCommitErr);
    }
    res.json({ success: true, data: syncGRNForDisplay(grn) });
  } catch (err) {
    await safeAbortTransaction(session);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

const markInvoiceSent = async (req, res) => {
  try {
    const { invoiceFileName, invoiceFileMime, invoiceFileData, invoiceNo, challanNo, invoiceDate } = req.body || {};
    const grnDoc = await GoodsReceipt.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!grnDoc) return res.status(404).json({ success: false, message: 'GRN not found' });
    const now = new Date();
    assertCanCompleteStage(grnDoc.workflowStages, 'invoice_to_ho', req.user);
    grnDoc.invoiceSentToHOActual = now;
    grnDoc.invoiceSentToHOStatus = 'Yes';
    grnDoc.invoiceChecked = true;
    if (invoiceNo) grnDoc.invoiceNo = invoiceNo;
    if (challanNo) grnDoc.challanNo = challanNo;
    if (invoiceDate) grnDoc.invoiceDate = new Date(invoiceDate);
    if (invoiceFileName) grnDoc.invoiceFileName = invoiceFileName;
    if (invoiceFileMime) grnDoc.invoiceFileMime = invoiceFileMime;
    if (invoiceFileData) grnDoc.invoiceFileData = invoiceFileData;
    const holidays = await fetchHolidayDates(req.tenantId);
    grnDoc.workflowStages = completeStage(grnDoc.workflowStages, 'invoice_to_ho', now, 'Yes', 'grn', holidays, grnDoc.actualReceiptDate || now);
    await grnDoc.save();
    const hoMsg = `📨 *INVOICE SENT TO H.O*\n\nPO: ${grnDoc.poNo}\nItem: ${grnDoc.itemDescription}\nVendor: ${grnDoc.vendorName}\nInvoice: ${grnDoc.invoiceNo || grnDoc.challanNo || '-'}\nFile: ${grnDoc.invoiceFileName || 'Uploaded from portal'}`;
    if (process.env.HO_INVOICE_EMAILS || process.env.STORE_MANAGER_EMAIL) sendEmail({ to: (process.env.HO_INVOICE_EMAILS || process.env.STORE_MANAGER_EMAIL).split(','), subject: `Invoice sent to H.O - ${grnDoc.poNo}`, html: `<pre>${hoMsg}</pre>` });
    if (process.env.HO_INVOICE_WHATSAPP) process.env.HO_INVOICE_WHATSAPP.split(',').forEach((p) => sendWhatsApp(p.trim(), hoMsg));
    await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'grn', doc: grnDoc, referenceNo: grnDoc.poNo, link: '/grn' });
    const grn = grnDoc;
    res.json({ success: true, data: syncGRNForDisplay(grn) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};


const markAccountsProcessed = async (req, res) => {
  try {
    const grnDoc = await GoodsReceipt.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!grnDoc) return res.status(404).json({ success: false, message: 'GRN not found' });
    const now = new Date();
    assertCanCompleteStage(grnDoc.workflowStages, 'accounts_process', req.user);
    grnDoc.accountsActual = now;
    grnDoc.accountsStatus = 'Yes';
    const holidays = await fetchHolidayDates(req.tenantId);
    grnDoc.workflowStages = completeStage(grnDoc.workflowStages, 'accounts_process', now, 'Yes', 'grn', holidays, grnDoc.actualReceiptDate || now);
    await grnDoc.save();
    const hoMsg = `📨 *INVOICE SENT TO H.O*\n\nPO: ${grnDoc.poNo}\nItem: ${grnDoc.itemDescription}\nVendor: ${grnDoc.vendorName}\nInvoice: ${grnDoc.invoiceNo || grnDoc.challanNo || '-'}\nFile: ${grnDoc.invoiceFileName || 'Uploaded from portal'}`;
    if (process.env.HO_INVOICE_EMAILS || process.env.STORE_MANAGER_EMAIL) sendEmail({ to: (process.env.HO_INVOICE_EMAILS || process.env.STORE_MANAGER_EMAIL).split(','), subject: `Invoice sent to H.O - ${grnDoc.poNo}`, html: `<pre>${hoMsg}</pre>` });
    if (process.env.HO_INVOICE_WHATSAPP) process.env.HO_INVOICE_WHATSAPP.split(',').forEach((p) => sendWhatsApp(p.trim(), hoMsg));
    await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'grn', doc: grnDoc, referenceNo: grnDoc.poNo, link: '/grn' });
    res.json({ success: true, data: syncGRNForDisplay(grnDoc) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};


const downloadNotePdf = async (req, res) => {
  try {
    const grn = await GoodsReceipt.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false }).lean();
    if (!grn) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (!grn.noteType || grn.noteType === 'None') return res.status(400).json({ success: false, message: 'No debit/credit note is available for this receipt' });
    const buffer = generateNotePdfBuffer(grn);
    const safeNo = String(grn.noteNo || `${grn.noteType}-${grn.poNo}`).replace(/[^a-zA-Z0-9._-]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeNo}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const listGRNs = async (req, res) => {
  try {
    const { status, poNo, search, page = 1, limit = 30 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false };
    if (status) query.status = status;
    if (poNo) query.poNo = { $regex: poNo, $options: 'i' };
    if (search) {
      query.$or = [
        { itemDescription: { $regex: search, $options: 'i' } },
        { skuCode: { $regex: search, $options: 'i' } },
        { vendorName: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [grns, total] = await Promise.all([
      GoodsReceipt.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      GoodsReceipt.countDocuments(query),
    ]);
    res.json({ success: true, data: grns.map(syncGRNForDisplay), total });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const getGRN = async (req, res) => {
  try {
    const grn = await GoodsReceipt.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false });
    res.json({ success: true, data: syncGRNForDisplay(grn) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = { createGRN, processQC, returnMaterial, markInvoiceSent, markAccountsProcessed, downloadNotePdf, listGRNs, getGRN };
