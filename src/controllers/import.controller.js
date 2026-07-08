const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const Tenant = require('../models/Tenant.schema');
const { importWorkbookForTenant } = require('../utils/import-excel');

const SECTION_MAP = {
  all: { label: 'Full IMS Master Import', file: 'store', sheets: null },
  items: { label: 'Items / Inventory', file: 'store', sheets: ['README', 'Items', 'Lists'] },
  vendors: { label: 'Vendors', file: 'store', sheets: ['README', 'Vendors', 'Lists'] },
  users: { label: 'Users & Access', file: 'store', sheets: ['README', 'Users', 'Lists'] },
  foundries: { label: 'Foundry & Departments', file: 'store', sheets: ['README', 'FoundriesDepartments', 'Users', 'Lists'] },
  fms: { label: 'FMS Templates', file: 'store', sheets: ['README', 'FmsTemplates', 'Users', 'Lists'] },
  budgets: { label: 'Department Budgets', file: 'store', sheets: ['README', 'Budgets', 'Items', 'Users', 'Lists'] },
  requisitions: { label: 'Requisitions', file: 'store', sheets: ['README', 'Requisitions', 'Items', 'Users', 'Lists'] },
  outwards: { label: 'Outward / Inter Department Transfer', file: 'store', sheets: ['README', 'Outwards', 'Requisitions', 'Items', 'Users', 'Lists'] },
  indents: { label: 'Purchase Indents', file: 'store', sheets: ['README', 'Indents', 'Items', 'Users', 'Lists'] },
  purchase_orders: { label: 'Purchase Orders', file: 'store', sheets: ['README', 'PurchaseOrders', 'Vendors', 'Items', 'Indents', 'Lists'] },
  grn: { label: 'Goods Receipt / Partial Receipts', file: 'store', sheets: ['README', 'GoodsReceipts', 'PurchaseOrders', 'Items', 'Vendors', 'Lists'] },
  holidays: { label: 'Holiday Calendar', file: 'store', sheets: ['README', 'Holidays', 'Lists'] },
  costing: { label: 'Foundry Costing', file: 'costing', sheets: null },
};

const templates = {
  store: path.join(__dirname, '../../import-templates/JPK_Store_Bulk_Import_Template.xlsx'),
  costing: path.join(__dirname, '../../import-templates/JPK_Costing_Input_Template_Apr2026_Jun2026.xlsx'),
};

const readTemplate = (kind) => {
  if (kind !== 'all') return XLSX.readFile(templates[kind], { cellDates: true });
  const store = XLSX.readFile(templates.store, { cellDates: true });
  const costing = XLSX.readFile(templates.costing, { cellDates: true });
  ['Production Metrics', 'Floor Material Left', 'Manual Cost Rows', 'Cost of Sales Rows', 'Misc Cost Breakup'].forEach((name) => {
    if (costing.Sheets[name] && !store.Sheets[name]) XLSX.utils.book_append_sheet(store, costing.Sheets[name], name);
  });
  return store;
};
const cloneSelectedSheets = (source, sheets) => {
  if (!sheets) return source;
  const out = XLSX.utils.book_new();
  sheets.forEach((name) => {
    if (source.Sheets[name]) XLSX.utils.book_append_sheet(out, source.Sheets[name], name);
  });
  return out;
};

const listImportSections = async (_req, res) => {
  res.json({ success: true, data: Object.entries(SECTION_MAP).map(([value, cfg]) => ({ value, label: cfg.label })) });
};

const downloadTemplate = async (req, res) => {
  const section = String(req.query.section || 'all');
  const cfg = SECTION_MAP[section] || SECTION_MAP.all;
  const wb = cloneSelectedSheets(readTemplate(section === 'all' ? 'all' : cfg.file), cfg.sheets);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="JPK_${section}_Import_Template.xlsx"`);
  res.send(buf);
};

const importExcel = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ success: false, message: 'Excel file is required' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const summary = await importWorkbookForTenant(tenant, wb);
    res.json({ success: true, summary, message: 'Excel import completed. Run migration if you imported FMS/PO/GRN historical data.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = { listImportSections, downloadTemplate, importExcel };
