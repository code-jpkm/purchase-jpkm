const { addTatDays, nextBusinessDayAt } = require('./business-time');

const addHours = (date, hours) => new Date(new Date(date).getTime() + Number(hours || 0) * 60 * 60 * 1000);
const addDays = (date, days) => new Date(new Date(date).getTime() + Number(days || 0) * 24 * 60 * 60 * 1000);

const formatDelay = (planned, actual) => {
  if (!planned || !actual) return '';
  const diff = new Date(actual).getTime() - new Date(planned).getTime();
  if (diff <= 0) return 'NO DELAY';
  const seconds = Math.floor(diff / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const slug = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || `step_${Date.now()}`;

const stage = ({ key, what, who, how, planned, tatDays = null, plannedMode = 'tat', statusOptions = ['Pending', 'Yes', 'No'], assignedUserId, assignedUserName, assignedUserEmail, assignedUserWhatsapp, buddyUserId, buddyUserName, buddyUserEmail, buddyUserWhatsapp, order }) => ({
  key,
  order,
  what,
  who,
  how,
  planned,
  actual: null,
  status: 'Pending',
  timeDelay: '',
  tatDays,
  plannedMode,
  statusOptions,
  assignedUserId,
  assignedUserName,
  assignedUserEmail,
  assignedUserWhatsapp,
  buddyUserId,
  buddyUserName,
  buddyUserEmail,
  buddyUserWhatsapp,
});

const asPlainStage = (stageDoc) => {
  if (!stageDoc) return {};
  if (typeof stageDoc.toObject === 'function') return stageDoc.toObject();
  return { ...stageDoc };
};

const normalizeStages = (stages = []) => (Array.isArray(stages) ? stages.map(asPlainStage).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) : []);

const FLOW_DEFS = {
  indent: [
    { key: 'indent_to_purchase', order: 1, what: 'Indent submitted to purchase department?', who: 'Arun Sahoo (Store)', how: 'Material indent slip / form', tatDays: 0.08333333333, plannedMode: 'tat' },
    { key: 'quote_po', order: 2, what: 'Get 3 quotation, finalise quotation and generate P.O', who: 'Soumen Shee', how: 'Email and Phone / Whatsapp and fill Google P.O form', tatDays: 3, plannedMode: 'tat' },
  ],
  po: [
    { key: 'supplier_followup_2h', order: 1, what: 'Follow up with supplier within 2 hours after submitting the P.O', who: 'Soumen Shee', how: 'Email and Phone / Whatsapp', tatDays: 0.08333333333, plannedMode: 'tat' },
    { key: 'supplier_followup_7d', order: 2, what: 'Follow up with supplier 7 working days after previous actual step', who: 'Soumen Shee', how: 'Email and Phone / Whatsapp', tatDays: 7, plannedMode: 'tat' },
    { key: 'supplier_followup_2d', order: 3, what: 'Follow up with supplier 2 working days after previous actual step', who: 'Soumen Shee', how: 'Email and Phone / Whatsapp', tatDays: 2, plannedMode: 'tat' },
  ],
  grn: [
    { key: 'receive_material', order: 1, what: 'Receive Material', who: 'Stores', how: 'Gate checklist 3A', tatDays: 0, plannedMode: 'tat' },
    { key: 'quality_quantity_check', order: 2, what: 'Quality and quantity check passed?', who: 'Arun Sahoo', how: 'Checklist QC master', tatDays: 0.04166666667, plannedMode: 'tat' },
    { key: 'return_material', order: 3, what: 'Return material', who: 'Arun Sahoo', how: 'Return checklist master', tatDays: 0.04166666667, plannedMode: 'tat' },
    { key: 'store_material', order: 4, what: 'Store Material', who: 'Arun Sahoo', how: 'MS Checklist', tatDays: null, plannedMode: 'next_day_10' },
    { key: 'invoice_to_ho', order: 5, what: 'Send invoice to H.O within two hour', who: 'Swagata Bawali', how: 'Invoice Checking Manually', tatDays: 0.08333333333, plannedMode: 'tat' },
    { key: 'accounts_process', order: 6, what: 'Accounts process', who: 'Accounts Department / Krishna', how: 'Follow Accounts Process Checklist', tatDays: 7, plannedMode: 'tat' },
  ],
};

const flowDefs = (flowType) => FLOW_DEFS[flowType] || [];

const defsFromStages = (stages, flowType) => {
  const current = normalizeStages(stages);
  if (!current.length) return flowDefs(flowType);
  const defaultDefs = new Map(flowDefs(flowType).map((d) => [d.key, d]));
  return current.map((s, index) => ({
    key: s.key,
    order: s.order || index + 1,
    what: s.what,
    who: s.who,
    how: s.how,
    tatDays: s.tatDays !== undefined ? s.tatDays : defaultDefs.get(s.key)?.tatDays,
    plannedMode: s.plannedMode || defaultDefs.get(s.key)?.plannedMode || 'tat',
  }));
};

const calculatePlannedFromBase = (def, base, holidays) => {
  if (!base) return null;
  if (def.plannedMode === 'none' || def.plannedMode === 'manual') return null;
  if (def.plannedMode === 'next_day_10') return nextBusinessDayAt(base, 10, holidays);
  if (def.tatDays === null || def.tatDays === undefined || def.tatDays === '') return null;
  return addTatDays(base, Number(def.tatDays || 0), holidays);
};

const replanSequentialStages = (stages, flowType, startDate = new Date(), holidays = []) => {
  const next = normalizeStages(stages);
  const defs = defsFromStages(next, flowType);
  let cursor = startDate || new Date();

  defs.forEach((def, index) => {
    const st = next.find((s) => s.key === def.key);
    if (!st) return;
    if (index === 0) cursor = startDate || st.actual || st.planned || new Date();
    const planned = calculatePlannedFromBase(def, cursor, holidays);
    if (planned || !st.planned) st.planned = planned;
    if (st.actual) st.timeDelay = formatDelay(st.planned, st.actual);
    cursor = st.actual || st.planned || cursor; // the next step is always from previous actual, otherwise previous planned
  });
  return next;
};

const completeStage = (stages, key, actual = new Date(), status = 'Yes', flowType = null, holidays = [], startDate = null) => {
  let next = normalizeStages(stages);
  const found = next.find((s) => s.key === key);
  if (found) {
    found.actual = actual;
    found.status = status;
    found.timeDelay = formatDelay(found.planned, actual);
  }
  if (flowType) next = replanSequentialStages(next, flowType, startDate || next[0]?.planned || actual, holidays);
  return next;
};

const setStageStatus = (stages, key, status = 'No', actual = null, flowType = null, holidays = [], startDate = null) => {
  let next = normalizeStages(stages);
  const found = next.find((stageDoc) => stageDoc.key === key);
  if (found) {
    found.actual = actual;
    found.status = status;
    found.timeDelay = actual ? formatDelay(found.planned, actual) : '';
  }
  if (flowType) next = replanSequentialStages(next, flowType, startDate || next[0]?.planned || actual || new Date(), holidays);
  return next;
};

const syncStageFromActual = (stages, key, actual, status = 'Yes', flowType = null, holidays = [], startDate = null) => {
  if (!actual) return normalizeStages(stages);
  return completeStage(stages, key, actual, status, flowType, holidays, startDate);
};

const completePendingStages = (stages, keys = [], actual = new Date(), flowType = null, holidays = [], startDate = null) => {
  let next = normalizeStages(stages);
  keys.forEach((key) => {
    const found = next.find((s) => s.key === key);
    if (found && found.status === 'Pending') {
      found.actual = actual;
      found.status = 'Yes';
      found.timeDelay = formatDelay(found.planned, actual);
    }
  });
  if (flowType) next = replanSequentialStages(next, flowType, startDate || next[0]?.planned || actual, holidays);
  return next;
};


const closePendingAfterStage = (stages, key, status = 'Skipped', actual = new Date(), flowType = null, holidays = [], startDate = null) => {
  let next = normalizeStages(stages);
  const idx = next.findIndex((s) => s.key === key);
  if (idx < 0) return next;
  // Returned material means the remaining downstream process is not applicable.
  // Keep those future stages visibly blank, not planned/overdue.
  for (let i = idx + 1; i < next.length; i += 1) {
    if (!next[i].actual && next[i].status === 'Pending') {
      next[i].planned = null;
      next[i].actual = null;
      next[i].status = status;
      next[i].timeDelay = '';
    }
  }
  return next;
};

const completeAnyPendingStage = (stages, key, actual = new Date(), status = 'Yes', flowType = null, holidays = [], startDate = null) => {
  let next = normalizeStages(stages);
  const found = next.find((s) => s.key === key);
  if (found) {
    found.actual = actual;
    found.status = status;
    found.timeDelay = formatDelay(found.planned, actual);
  }
  if (flowType) next = replanSequentialStages(next, flowType, startDate || next[0]?.planned || actual, holidays);
  return next;
};

const makeStagesFromDefs = (defs, baseDate = new Date(), holidays = [], flowType) => {
  const rows = (defs || []).filter((d) => d.isActive !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((d, index) => stage({
    key: d.key || slug(d.what),
    order: d.order || index + 1,
    what: d.what,
    who: d.who,
    how: d.how,
    planned: baseDate,
    tatDays: d.tatDays,
    plannedMode: d.plannedMode || 'tat',
    statusOptions: d.statusOptions && d.statusOptions.length ? d.statusOptions : ['Pending', 'Yes', 'No'],
    assignedUserId: d.assignedUserId,
    assignedUserName: d.assignedUserName,
    assignedUserEmail: d.assignedUserEmail,
    assignedUserWhatsapp: d.assignedUserWhatsapp,
    buddyUserId: d.buddyUserId,
    buddyUserName: d.buddyUserName,
    buddyUserEmail: d.buddyUserEmail,
    buddyUserWhatsapp: d.buddyUserWhatsapp,
  }));
  return replanSequentialStages(rows, flowType, baseDate, holidays);
};

const buildIndentStages = (baseDate = new Date(), holidays = [], defs = null) => makeStagesFromDefs(defs || flowDefs('indent'), baseDate, holidays, 'indent');
const buildPOStages = (poDate = new Date(), _unusedEarliestDelivery = null, holidays = [], defs = null) => makeStagesFromDefs(defs || flowDefs('po'), poDate, holidays, 'po');
const nextDayTenAM = (date, holidays = []) => nextBusinessDayAt(date, 10, holidays);
const buildGRNStages = (receiptDate = new Date(), holidays = [], defs = null) => makeStagesFromDefs(defs || flowDefs('grn'), receiptDate, holidays, 'grn');

module.exports = {
  addHours,
  addDays,
  formatDelay,
  stage,
  slug,
  normalizeStages,
  completeStage,
  setStageStatus,
  syncStageFromActual,
  completePendingStages,
  closePendingAfterStage,
  completeAnyPendingStage,
  replanSequentialStages,
  buildIndentStages,
  buildPOStages,
  nextDayTenAM,
  buildGRNStages,
  FLOW_DEFS,
  makeStagesFromDefs,
};
