const FmsTemplate = require('../models/Fms-template.schema');
const UserTask = require('../models/User-task.schema');
const StoreNotification = require('../models/Notification-store.schema');
const User = require('../models/User.schema');
const Indent = require('../models/Indent.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const { FLOW_DEFS, buildIndentStages, buildPOStages, buildGRNStages, normalizeStages } = require('../utils/workflow');
const { sendEmail, sendWhatsApp } = require('./notification.service');

const FLOW_META = {
  indent: { name: 'Purchase Indent FMS', model: 'Indent', link: '/indents' },
  po: { name: 'Purchase Order FMS', model: 'PurchaseOrder', link: '/purchase-orders' },
  grn: { name: 'Goods Receipt / Item Wise FMS', model: 'GoodsReceipt', link: '/grn' },
};

const defaultTemplates = (tenantId) => Object.keys(FLOW_DEFS).map((flowType) => ({
  tenantId,
  flowType,
  name: FLOW_META[flowType].name,
  description: 'Factory FMS steps used to auto-plan tasks, planned/actual/status/delay and user reminders.',
  steps: FLOW_DEFS[flowType].map((d, index) => ({ ...d, order: d.order || index + 1, statusOptions: ['Pending', 'Yes', 'No', 'Hold', 'Skipped'] })),
}));

const ensureFmsTemplates = async (tenantId) => {
  const out = [];
  for (const tpl of defaultTemplates(tenantId)) {
    const found = await FmsTemplate.findOneAndUpdate(
      { tenantId, flowType: tpl.flowType },
      { $setOnInsert: tpl },
      { upsert: true, new: true }
    ).lean();
    out.push(found);
  }
  return out;
};

const getTemplate = async (tenantId, flowType) => {
  let tpl = await FmsTemplate.findOne({ tenantId, flowType, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean();
  if (!tpl) {
    await ensureFmsTemplates(tenantId);
    tpl = await FmsTemplate.findOne({ tenantId, flowType, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean();
  }
  return tpl;
};

const buildFmsStages = async (tenantId, flowType, baseDate, holidays = [], extra = {}) => {
  const tpl = await getTemplate(tenantId, flowType);
  const steps = tpl?.steps?.length ? tpl.steps : FLOW_DEFS[flowType];
  if (flowType === 'indent') return buildIndentStages(baseDate, holidays, steps);
  if (flowType === 'po') return buildPOStages(baseDate, extra.earliestDelivery, holidays, steps);
  if (flowType === 'grn') return buildGRNStages(baseDate, holidays, steps);
  return [];
};


const canCompleteStage = (stage, user = {}) => {
  if (!stage || !user) return false;
  if (['super_admin', 'admin'].includes(user.role)) return true;
  const userId = String(user.userId || user.id || user._id || '');
  const userEmail = String(user.email || '').toLowerCase();
  const assignedId = String(stage.assignedUserId || '');
  const buddyId = String(stage.buddyUserId || '');
  if (userId && (userId === assignedId || userId === buddyId)) return true;
  if (userEmail && [stage.assignedUserEmail, stage.buddyUserEmail].map((x) => String(x || '').toLowerCase()).includes(userEmail)) return true;
  const name = String(user.name || '').toLowerCase();
  const who = String(stage.who || stage.assignedUserName || '').toLowerCase();
  if (name && who && (who === name || who.includes(name) || name.includes(who))) return true;
  return false;
};

const assertCanCompleteStage = (stages = [], key, user = {}) => {
  const stage = normalizeStages(stages).find((s) => s.key === key);
  if (!stage) {
    const err = new Error('FMS step not found');
    err.statusCode = 404;
    throw err;
  }
  if (!canCompleteStage(stage, user)) {
    const err = new Error(`Only assigned user${stage.buddyUserName ? ', buddy' : ''} or admin can complete this FMS step. Assigned: ${stage.assignedUserName || stage.who || 'Not mapped'}${stage.buddyUserName ? `, Buddy: ${stage.buddyUserName}` : ''}`);
    err.statusCode = 403;
    throw err;
  }
  return stage;
};

const stageAssigneeMatches = (stage, user) => {
  if (!stage || !user) return false;
  if (stage.assignedUserId && String(stage.assignedUserId) === String(user._id || user.id || user.userId)) return true;
  if (stage.buddyUserId && String(stage.buddyUserId) === String(user._id || user.id || user.userId)) return true;
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  const who = String(stage.who || '').toLowerCase();
  return !!name && (who.includes(name) || (!!email && [stage.assignedUserEmail, stage.buddyUserEmail].map((x) => String(x || '').toLowerCase()).includes(email)));
};

const taskPriority = (plannedAt) => {
  if (!plannedAt) return 'MEDIUM';
  const diff = new Date(plannedAt).getTime() - Date.now();
  if (diff < 0) return 'CRITICAL';
  if (diff < 24 * 60 * 60 * 1000) return 'HIGH';
  if (diff < 48 * 60 * 60 * 1000) return 'MEDIUM';
  return 'LOW';
};

const syncTasksForDocument = async ({ tenantId, fmsType, doc, referenceNo, subtitle, link }) => {
  const stages = normalizeStages(doc.workflowStages || []);
  for (const stage of stages) {
    const filter = { tenantId, referenceId: doc._id, stepKey: stage.key };
    const isDone = !!stage.actual || stage.status !== 'Pending';
    const assignedQuery = stage.assignedUserId ? { _id: stage.assignedUserId } : stage.assignedUserEmail ? { email: String(stage.assignedUserEmail).toLowerCase() } : null;
    let assigned = assignedQuery ? await User.findOne({ tenantId, ...assignedQuery, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean() : null;
    if (!assigned && stage.who) {
      assigned = await User.findOne({ tenantId, name: { $regex: `^${String(stage.who).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean();
    }
    await UserTask.findOneAndUpdate(
      filter,
      {
        tenantId,
        userId: assigned?._id || stage.assignedUserId || undefined,
        userName: assigned?.name || stage.assignedUserName || stage.who,
        userEmail: assigned?.email || stage.assignedUserEmail,
        userWhatsapp: assigned?.whatsapp || assigned?.phone || stage.assignedUserWhatsapp,
        buddyUserId: stage.buddyUserId,
        buddyUserName: stage.buddyUserName,
        buddyUserEmail: stage.buddyUserEmail,
        buddyUserWhatsapp: stage.buddyUserWhatsapp,
        fmsType,
        referenceModel: FLOW_META[fmsType].model,
        referenceId: doc._id,
        referenceNo,
        stepKey: stage.key,
        stepWhat: stage.what,
        stepHow: stage.how,
        plannedAt: stage.planned,
        actualAt: stage.actual,
        status: isDone ? stage.status || 'Yes' : 'Pending',
        link,
        priority: taskPriority(stage.planned),
        isDeleted: false,
      },
      { upsert: true, new: true }
    );
  }
};

const syncAllOpenTasks = async (tenantId) => {
  const [indents, pos, grns] = await Promise.all([
    Indent.find({ tenantId, isDeleted: false, status: { $nin: ['Cancelled', 'Fully Received'] } }).limit(1000),
    PurchaseOrder.find({ tenantId, isDeleted: false, status: { $nin: ['Cancelled', 'Closed', 'Fully Received'] } }).limit(1000),
    GoodsReceipt.find({ tenantId, isDeleted: false, status: { $nin: ['Returned'] } }).limit(1000),
  ]);
  for (const d of indents) await syncTasksForDocument({ tenantId, fmsType: 'indent', doc: d, referenceNo: d.indentNo, link: '/indents' });
  for (const d of pos) await syncTasksForDocument({ tenantId, fmsType: 'po', doc: d, referenceNo: d.poNo, link: '/purchase-orders' });
  for (const d of grns) await syncTasksForDocument({ tenantId, fmsType: 'grn', doc: d, referenceNo: d.poNo, link: '/grn' });
};

const sendFmsDueReminders = async () => {
  const now = new Date();
  const tomorrowStart = new Date(now); tomorrowStart.setDate(now.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const tasks = await UserTask.find({
    isDeleted: false,
    status: 'Pending',
    plannedAt: { $lte: tomorrowEnd },
    $or: [{ lastNotifiedAt: { $exists: false } }, { lastNotifiedAt: { $lt: new Date(now.getTime() - 12 * 60 * 60 * 1000) } }],
  }).limit(500);
  for (const task of tasks) {
    const type = task.plannedAt < now ? 'FMS_OVERDUE' : task.plannedAt <= todayEnd ? 'FMS_DUE_TODAY' : 'FMS_DUE_TOMORROW';
    const title = type === 'FMS_OVERDUE' ? `Overdue task: ${task.referenceNo}` : type === 'FMS_DUE_TODAY' ? `Due today: ${task.referenceNo}` : `Due tomorrow: ${task.referenceNo}`;
    const msg = `⏱️ *${title}*\n\nFMS: ${task.fmsType.toUpperCase()}\nRef: ${task.referenceNo}\nStep: ${task.stepWhat}\nWhen: ${task.plannedAt ? new Date(task.plannedAt).toLocaleString('en-IN') : 'Manual'}\nPlease complete it in JPK IMS.\n\n_JPK Store System_`;
    await StoreNotification.create({ tenantId: task.tenantId, type, title, message: msg, referenceModel: task.referenceModel, referenceId: task.referenceId, referenceNo: task.referenceNo, targetUsers: task.userId ? [task.userId] : [], priority: taskPriority(task.plannedAt) });
    if (task.userEmail) sendEmail({ to: task.userEmail, subject: title, html: `<pre>${msg}</pre>` });
    if (task.userWhatsapp) sendWhatsApp(task.userWhatsapp, msg);
    if (task.buddyUserEmail && type === 'FMS_OVERDUE') sendEmail({ to: task.buddyUserEmail, subject: `Buddy backup required - ${title}`, html: `<pre>${msg}\n\nYou are the assigned buddy for this step.</pre>` });
    if (task.buddyUserWhatsapp && type === 'FMS_OVERDUE') sendWhatsApp(task.buddyUserWhatsapp, `${msg}\n\nYou are the assigned buddy for this step.`);
    task.lastNotifiedAt = now;
    await task.save();
  }
  return tasks.length;
};

module.exports = {
  FLOW_META,
  defaultTemplates,
  ensureFmsTemplates,
  getTemplate,
  buildFmsStages,
  syncTasksForDocument,
  syncAllOpenTasks,
  stageAssigneeMatches,
  sendFmsDueReminders,
  canCompleteStage,
  assertCanCompleteStage,
};
