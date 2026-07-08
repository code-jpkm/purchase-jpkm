const mongoose = require('mongoose');
const Indent = require('../models/Indent.schema');
const StoreItem = require('../models/Store-item.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const { sendEmail, sendWhatsApp } = require('../services/notification.service');
const { getFiscalYear } = require('../utils/fiscal');
const { completeStage, formatDelay } = require('../utils/workflow');
const { buildFmsStages, syncTasksForDocument, assertCanCompleteStage } = require('../services/fms.service');
const { fetchHolidayDates } = require('../utils/business-time');
const { getStockEntry } = require('../utils/inventory-query');

const safeAbortTransaction = async (session) => {
  if (session && typeof session.inTransaction === 'function' && session.inTransaction()) {
    await session.abortTransaction();
  }
};

const buildIndentNo = (prefix, seq, isHO, hoSeq) => {
  if (isHO) return `${prefix}/H.O ${hoSeq}`;
  return `${prefix}/${seq}`;
};


const syncIndentForDisplay = (indentDoc) => {
  const indent = typeof indentDoc.toObject === 'function' ? indentDoc.toObject() : { ...indentDoc };
  const stages = Array.isArray(indent.workflowStages) ? indent.workflowStages.map((st) => ({ ...st })) : [];
  const apply = (key, actual, status = 'Yes', delay) => {
    if (!actual) return;
    const found = stages.find((st) => st.key === key);
    if (found) {
      found.actual = found.actual || actual;
      found.status = found.status === 'Pending' ? status : found.status;
      found.timeDelay = found.timeDelay || delay || formatDelay(found.planned, found.actual);
    }
  };
  apply('indent_to_purchase', indent.storeAckActual, indent.storeAckStatus || 'Yes', indent.storeAckDelay);
  apply('quote_po', indent.poActual, indent.poStatus || 'Yes');
  indent.workflowStages = stages;
  return indent;
};

const toLines = (body) => {
  if (Array.isArray(body.items) && body.items.length) return body.items;
  return [{
    skuCode: body.skuCode,
    foundry: body.foundry,
    department: body.department,
    requiredQty: body.requiredQty,
    uploadedIndentCopyUrl: body.uploadedIndentCopyUrl,
  }];
};

// POST /api/store/indents - supports one indent number with multiple item rows
const createIndent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { indentDate, isHO } = req.body;
    const lines = toLines(req.body);
    if (!lines.length) throw new Error('At least one indent item is required');

    const tenantId = req.tenantId;
    const now = new Date();
    const effectiveDate = new Date(indentDate || now);
    const fy = getFiscalYear(effectiveDate);
    const prefix = `JPKM/ IND/ ${fy}`;
    const seqType = isHO ? 'INDENT_HO' : 'INDENT';
    const seqNo = await StoreSequence.nextSeq(tenantId, seqType, fy, prefix);
    const indentNo = buildIndentNo(prefix, seqNo, isHO, seqNo);
    const holidays = await fetchHolidayDates(tenantId);
    const workflowStages = await buildFmsStages(tenantId, 'indent', now, holidays);

    const docs = [];
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const { skuCode, foundry, department } = line;
      const requiredQty = Number(line.requiredQty || line.qty || 0);
      if (!skuCode || !foundry || !department || requiredQty <= 0) {
        throw new Error(`Line ${idx + 1}: SKU, foundry, department and required quantity are required`);
      }

      const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true }, isActive: { $ne: false } }).session(session);
      if (!item) throw new Error(`Line ${idx + 1}: SKU not found: ${skuCode}`);
      const stockEntry = getStockEntry(item, foundry, department);
      const stockPosition = stockEntry?.currentQty || 0;

      docs.push({
        tenantId,
        prefix,
        seqNo,
        indentNo,
        lineNo: idx + 1,
        isHO: !!isHO,
        indentDate: effectiveDate,
        requestedBy: req.user.userId,
        requestorName: req.user.name,
        skuCode,
        storeItemId: item._id,
        foundry,
        department,
        itemName: item.itemName,
        uom: item.uom,
        requiredQty,
        stockPosition,
        storeAckPlanned: workflowStages[0].planned,
        poPlanned: workflowStages[1].planned,
        workflowStages,
        status: 'Submitted',
        uploadedIndentCopyUrl: line.uploadedIndentCopyUrl || req.body.uploadedIndentCopyUrl,
      });
    }

    const created = await Indent.insertMany(docs, { session });
    await session.commitTransaction();

    try {
      const totalQtyText = created.map((d) => `${d.itemName}: ${d.requiredQty} ${d.uom}`).join('\n');
      const msg = `📋 *NEW INDENT SUBMITTED*\n\nIndent No: ${indentNo}\nDepartment: ${created[0].foundry} / ${created[0].department}\nItems: ${created.length}\n${totalQtyText}\n\n_Please acknowledge within 2 hours_\n\n_JPK Store System_`;
      if (process.env.STORE_MANAGER_EMAIL) sendEmail({ to: process.env.STORE_MANAGER_EMAIL, subject: `New Indent: ${indentNo}`, html: `<pre>${msg}</pre>` });
      if (process.env.STORE_MANAGER_WHATSAPP) sendWhatsApp(process.env.STORE_MANAGER_WHATSAPP, msg);

      for (const doc of created) await syncTasksForDocument({ tenantId, fmsType: 'indent', doc, referenceNo: doc.indentNo, link: '/indents' });
    } catch (postCommitErr) {
      console.error('Indent created, but post-commit notification/task sync failed:', postCommitErr);
    }

    res.status(201).json({ success: true, data: { indentNo, items: created } });
  } catch (err) {
    await safeAbortTransaction(session);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/store/indents
const listIndents = async (req, res) => {
  try {
    const { status, foundry, department, search, from, to, group, page = 1, limit = 30 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false };

    if (status) query.status = status;
    if (foundry) query.foundry = foundry;
    if (department) query.department = { $regex: department, $options: 'i' };
    if (search) {
      query.$or = [
        { indentNo: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } },
        { skuCode: { $regex: search, $options: 'i' } },
      ];
    }
    if (from || to) {
      query.indentDate = {};
      if (from) query.indentDate.$gte = new Date(from);
      if (to) query.indentDate.$lte = new Date(to);
    }

    if (group === 'true') {
      const rawRows = await Indent.find(query).sort({ indentDate: -1, indentNo: -1, lineNo: 1 }).limit(500);
      const rows = rawRows.map(syncIndentForDisplay);
      const grouped = Object.values(rows.reduce((acc, row) => {
        const key = row.indentNo;
        if (!acc[key]) acc[key] = {
          indentNo: row.indentNo,
          indentDate: row.indentDate,
          foundry: row.foundry,
          department: row.department,
          requestorName: row.requestorName,
          status: row.status,
          itemCount: 0,
          totalQty: 0,
          items: [],
        };
        acc[key].itemCount += 1;
        acc[key].totalQty += Number(row.requiredQty || 0);
        acc[key].items.push(row);
        return acc;
      }, {}));
      return res.json({ success: true, data: grouped, total: grouped.length });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [indents, total] = await Promise.all([
      Indent.find(query).sort({ createdAt: -1, lineNo: 1 }).skip(skip).limit(parseInt(limit)),
      Indent.countDocuments(query),
    ]);

    res.json({ success: true, data: indents.map(syncIndentForDisplay), total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/indents/open-groups - only rows not placed in PO
const listOpenIndentGroups = async (req, res) => {
  try {
    const { search, limit = 200 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false, status: { $in: ['Submitted', 'Acknowledged'] }, $or: [{ purchaseOrderId: { $exists: false } }, { purchaseOrderId: null }] };
    if (search) query.indentNo = { $regex: search, $options: 'i' };
    const rawRows = await Indent.find(query).sort({ indentDate: -1, indentNo: -1, lineNo: 1 }).limit(parseInt(limit));
    const rows = rawRows.map(syncIndentForDisplay);
    const grouped = Object.values(rows.reduce((acc, row) => {
      const key = row.indentNo;
      if (!acc[key]) acc[key] = { indentNo: row.indentNo, indentDate: row.indentDate, foundry: row.foundry, department: row.department, requestorName: row.requestorName, itemCount: 0, items: [] };
      acc[key].itemCount += 1;
      acc[key].items.push(row);
      return acc;
    }, {}));
    res.json({ success: true, data: grouped, total: grouped.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/indents/:id
const getIndent = async (req, res) => {
  try {
    const indent = await Indent.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('storeItemId', 'skuCode itemName uom rate lastVendorName lastPurchaseDate')
      .populate('requestedBy', 'name email');
    if (!indent) return res.status(404).json({ success: false, message: 'Indent not found' });
    res.json({ success: true, data: syncIndentForDisplay(indent) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/store/indents/:id/acknowledge — store acknowledges line and same indent group
const acknowledgeIndent = async (req, res) => {
  try {
    const now = new Date();
    const indent = await Indent.findOne({ _id: req.params.id, tenantId: req.tenantId, status: 'Submitted' });
    if (!indent) return res.status(404).json({ success: false, message: 'Indent not found or already acknowledged' });

    const holidays = await fetchHolidayDates(req.tenantId);
    assertCanCompleteStage(indent.workflowStages, 'indent_to_purchase', req.user);
    const stages = completeStage(indent.workflowStages, 'indent_to_purchase', now, 'Yes', 'indent', holidays, indent.createdAt || indent.indentDate || now);
    const delay = formatDelay(indent.storeAckPlanned, now);
    await Indent.updateMany(
      { tenantId: req.tenantId, indentNo: indent.indentNo, status: 'Submitted' },
      { storeAckActual: now, storeAckStatus: 'Yes', storeAckDelay: delay, status: 'Acknowledged', workflowStages: stages }
    );
    const updated = await Indent.find({ tenantId: req.tenantId, indentNo: indent.indentNo }).sort({ lineNo: 1 });
    for (const doc of updated) await syncTasksForDocument({ tenantId: req.tenantId, fmsType: 'indent', doc, referenceNo: doc.indentNo, link: '/indents' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/store/indents/:id/cancel
const cancelIndent = async (req, res) => {
  try {
    const indent = await Indent.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, status: { $in: ['Submitted', 'Acknowledged'] } },
      { status: 'Cancelled', remarks: req.body.remarks },
      { new: true }
    );
    if (!indent) return res.status(404).json({ success: false, message: 'Cannot cancel indent' });
    res.json({ success: true, data: syncIndentForDisplay(indent) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createIndent, listIndents, listOpenIndentGroups, getIndent, acknowledgeIndent, cancelIndent };
