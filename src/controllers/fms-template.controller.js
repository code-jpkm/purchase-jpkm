const FmsTemplate = require('../models/Fms-template.schema');
const User = require('../models/User.schema');
const { ensureFmsTemplates, syncAllOpenTasks } = require('../services/fms.service');
const { slug, completeAnyPendingStage, closePendingAfterStage } = require('../utils/workflow');
const { assertCanCompleteStage, syncTasksForDocument } = require('../services/fms.service');
const { fetchHolidayDates } = require('../utils/business-time');
const Indent = require('../models/Indent.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');

const sanitizeSteps = async (tenantId, steps = []) => {
  const out = [];
  for (let i = 0; i < steps.length; i += 1) {
    const raw = steps[i] || {};
    if (!raw.what) continue;
    let assigned = null;
    let buddy = null;
    if (raw.assignedUserId) assigned = await User.findOne({ tenantId, _id: raw.assignedUserId, isDeleted: { $ne: true } }).lean();
    if (raw.buddyUserId) buddy = await User.findOne({ tenantId, _id: raw.buddyUserId, isDeleted: { $ne: true } }).lean();
    out.push({
      key: raw.key || slug(raw.what),
      order: Number(raw.order || i + 1),
      what: String(raw.what || '').trim(),
      who: String(raw.who || assigned?.name || '').trim(),
      how: String(raw.how || '').trim(),
      assignedUserId: assigned?._id || raw.assignedUserId || undefined,
      assignedUserName: assigned?.name || raw.assignedUserName || raw.who || '',
      assignedUserEmail: assigned?.email || raw.assignedUserEmail || '',
      assignedUserWhatsapp: assigned?.whatsapp || assigned?.phone || raw.assignedUserWhatsapp || '',
      buddyUserId: buddy?._id || raw.buddyUserId || undefined,
      buddyUserName: buddy?.name || raw.buddyUserName || '',
      buddyUserEmail: buddy?.email || raw.buddyUserEmail || '',
      buddyUserWhatsapp: buddy?.whatsapp || buddy?.phone || raw.buddyUserWhatsapp || '',
      tatDays: raw.tatDays === '' || raw.tatDays === null || raw.tatDays === undefined ? null : Number(raw.tatDays),
      plannedMode: raw.plannedMode || (raw.tatDays === '' || raw.tatDays === null || raw.tatDays === undefined ? 'manual' : 'tat'),
      statusOptions: Array.isArray(raw.statusOptions) && raw.statusOptions.length ? raw.statusOptions : ['Pending', 'Yes', 'No', 'Hold', 'Skipped'],
      isActive: raw.isActive !== false,
    });
  }
  return out.sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
};

const listTemplates = async (req, res) => {
  try {
    await ensureFmsTemplates(req.tenantId);
    const [templates, users] = await Promise.all([
      FmsTemplate.find({ tenantId: req.tenantId, isDeleted: { $ne: true } }).sort({ flowType: 1 }).lean(),
      User.find({ tenantId: req.tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } }, 'name email role whatsapp phone department foundry').sort({ name: 1 }).lean(),
    ]);
    res.json({ success: true, data: templates, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateTemplate = async (req, res) => {
  try {
    const { flowType } = req.params;
    const steps = await sanitizeSteps(req.tenantId, req.body.steps || []);
    const template = await FmsTemplate.findOneAndUpdate(
      { tenantId: req.tenantId, flowType },
      { name: req.body.name || `${flowType.toUpperCase()} FMS`, description: req.body.description || '', steps, isActive: req.body.isActive !== false },
      { new: true, upsert: true, runValidators: true }
    );
    await syncAllOpenTasks(req.tenantId);
    res.json({ success: true, data: template });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const addStepToAll = async (req, res) => {
  try {
    const { what, who, how, tatDays, plannedMode, assignedUserId, buddyUserId } = req.body;
    if (!what) return res.status(400).json({ success: false, message: 'What/job is required' });
    await ensureFmsTemplates(req.tenantId);
    const templates = await FmsTemplate.find({ tenantId: req.tenantId, isDeleted: { $ne: true } });
    const user = assignedUserId ? await User.findOne({ tenantId: req.tenantId, _id: assignedUserId }).lean() : null;
    const buddy = buddyUserId ? await User.findOne({ tenantId: req.tenantId, _id: buddyUserId }).lean() : null;
    for (const tpl of templates) {
      tpl.steps.push({
        key: slug(`${tpl.flowType}_${what}`),
        order: tpl.steps.length + 1,
        what,
        who: who || user?.name || '',
        how: how || '',
        tatDays: tatDays === '' || tatDays === undefined ? null : Number(tatDays),
        plannedMode: plannedMode || (tatDays === '' || tatDays === undefined ? 'manual' : 'tat'),
        assignedUserId: user?._id,
        assignedUserName: user?.name,
        assignedUserEmail: user?.email,
        assignedUserWhatsapp: user?.whatsapp || user?.phone,
        buddyUserId: buddy?._id,
        buddyUserName: buddy?.name,
        buddyUserEmail: buddy?.email,
        buddyUserWhatsapp: buddy?.whatsapp || buddy?.phone,
        statusOptions: ['Pending', 'Yes', 'No', 'Hold', 'Skipped'],
      });
      await tpl.save();
    }
    await syncAllOpenTasks(req.tenantId);
    res.json({ success: true, message: 'Step added to Indent, PO and Goods Receipt FMS' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const applyExisting = async (req, res) => {
  try {
    await syncAllOpenTasks(req.tenantId);
    res.json({ success: true, message: 'Open FMS tasks re-synced' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const MODEL_BY_FLOW = {
  indent: { Model: Indent, noField: 'indentNo', link: '/indents', referenceModel: 'Indent' },
  po: { Model: PurchaseOrder, noField: 'poNo', link: '/purchase-orders', referenceModel: 'PurchaseOrder' },
  grn: { Model: GoodsReceipt, noField: 'poNo', link: '/grn', referenceModel: 'GoodsReceipt' },
};

const completeDocumentStage = async (req, res) => {
  try {
    const { fmsType, referenceId, stepKey, status = 'Yes', actualAt } = req.body;
    if (!fmsType || !referenceId || !stepKey) return res.status(400).json({ success: false, message: 'fmsType, referenceId and stepKey are required' });
    const meta = MODEL_BY_FLOW[fmsType];
    if (!meta) return res.status(400).json({ success: false, message: 'Invalid FMS type' });
    const doc = await meta.Model.findOne({ _id: referenceId, tenantId: req.tenantId, isDeleted: { $ne: true } });
    if (!doc) return res.status(404).json({ success: false, message: 'FMS document not found' });
    assertCanCompleteStage(doc.workflowStages, stepKey, req.user);
    const now = actualAt ? new Date(actualAt) : new Date();
    const holidays = await fetchHolidayDates(req.tenantId);
    doc.workflowStages = completeAnyPendingStage(doc.workflowStages, stepKey, now, status, fmsType, holidays, doc.createdAt || doc.indentDate || doc.poDate || doc.actualReceiptDate || now);

    if (fmsType === 'po') {
      const idx = (doc.workflowStages || []).findIndex((s) => s.key === stepKey);
      if (idx === 0) { doc.followUp1Actual = now; doc.followUp1Status = status; doc.followUp1Delay = doc.workflowStages[idx]?.timeDelay; }
      if (idx === 1) { doc.followUp2Actual = now; doc.followUp2Status = status; doc.followUp2Delay = doc.workflowStages[idx]?.timeDelay; }
      if (idx === 2) { doc.followUp3Actual = now; doc.followUp3Status = status; doc.followUp3Delay = doc.workflowStages[idx]?.timeDelay; }
    }
    if (fmsType === 'indent') {
      if (stepKey === 'indent_to_purchase') { doc.storeAckActual = now; doc.storeAckStatus = status; doc.storeAckDelay = doc.workflowStages.find((s) => s.key === stepKey)?.timeDelay; if (doc.status === 'Submitted') doc.status = 'Acknowledged'; }
      if (stepKey === 'quote_po') { doc.poActual = now; doc.poStatus = status; doc.poDelay = doc.workflowStages.find((s) => s.key === stepKey)?.timeDelay; }
    }
    if (fmsType === 'grn') {
      if (stepKey === 'quality_quantity_check') { doc.qqCheckActual = now; doc.qqCheckStatus = status === 'Yes' ? 'Passed' : status === 'No' ? 'Failed' : status; }
      if (stepKey === 'return_material') { doc.materialReturned = true; doc.returnedAt = now; doc.status = 'Returned'; doc.workflowStages = closePendingAfterStage(doc.workflowStages, stepKey, 'Skipped', now, 'grn', holidays, doc.actualReceiptDate || now); }
      if (stepKey === 'store_material') { doc.stockAdded = true; doc.stockAddedAt = now; doc.storeActual = now; doc.storeStatus = status; doc.status = doc.status === 'Pending QC' ? 'Stocked' : doc.status; }
      if (stepKey === 'invoice_to_ho') { doc.invoiceSentToHOActual = now; doc.invoiceSentToHOStatus = status; }
      if (stepKey === 'accounts_process') { doc.accountsActual = now; doc.accountsStatus = status; }
    }
    await doc.save();
    await syncTasksForDocument({ tenantId: req.tenantId, fmsType, doc, referenceNo: doc[meta.noField], link: meta.link });
    res.json({ success: true, data: doc });
  } catch (err) { res.status(err.statusCode || 500).json({ success: false, message: err.message }); }
};

module.exports = { listTemplates, updateTemplate, addStepToAll, applyExisting, completeDocumentStage };
