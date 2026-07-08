const Tenant = require('../models/Tenant.schema');
const GoogleSheetImport = require('../models/Google-sheet-import.schema');
const { importWorkbookForTenant } = require('../utils/import-excel');
const { SECTION_TO_SHEET, previewGoogleSheet, buildWorkbookFromRows, parseRows, mapHeaders, fetchSheetValues, detectHeaderRow } = require('../services/google-sheet.service');

const sections = Object.entries(SECTION_TO_SHEET).map(([value, sheetName]) => ({ value, sheetName, label: sheetName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) }));

const listSections = async (_req, res) => res.json({ success: true, data: sections });

const preview = async (req, res) => {
  try {
    const data = await previewGoogleSheet(req.body || {});
    await GoogleSheetImport.create({
      tenantId: req.tenantId,
      userId: req.user.userId,
      userName: req.user.name || req.user.email,
      targetSection: data.targetSection,
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: req.body.spreadsheetUrl,
      sheetName: req.body.sheetName,
      range: req.body.range,
      headerRow: data.headerRow,
      dateColumn: req.body.dateColumn,
      fromDate: req.body.fromDate || undefined,
      toDate: req.body.toDate || undefined,
      detectedHeaders: data.detectedHeaders,
      mappedHeaders: data.mappedHeaders,
      missingHeaders: data.missingHeaders,
      importedRows: 0,
      status: 'Previewed',
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const importFromGoogleSheet = async (req, res) => {
  try {
    const payload = req.body || {};
    const targetSection = payload.targetSection || 'items';
    const targetSheetName = SECTION_TO_SHEET[targetSection];
    if (!targetSheetName) return res.status(400).json({ success: false, message: 'Invalid target section' });
    const fetched = await fetchSheetValues(payload);
    const headerRowIndex = detectHeaderRow(fetched.values, payload.headerRow);
    const { headers, rows } = parseRows(fetched.values, headerRowIndex, payload.dateColumn, payload.fromDate, payload.toDate);
    const mapping = payload.mappedHeaders && Object.keys(payload.mappedHeaders).length ? payload.mappedHeaders : mapHeaders(headers, targetSheetName).mapped;
    const missing = mapHeaders(headers, targetSheetName).missing;
    const { wb, sheetName, data } = buildWorkbookFromRows(targetSection, rows, mapping);
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const summary = await importWorkbookForTenant(tenant, wb, { sections: [sheetName] });
    await GoogleSheetImport.create({
      tenantId: req.tenantId,
      userId: req.user.userId,
      userName: req.user.name || req.user.email,
      targetSection,
      spreadsheetId: fetched.spreadsheetId,
      spreadsheetUrl: payload.spreadsheetUrl,
      sheetName: payload.sheetName,
      range: payload.range,
      headerRow: headerRowIndex + 1,
      dateColumn: payload.dateColumn,
      fromDate: payload.fromDate || undefined,
      toDate: payload.toDate || undefined,
      detectedHeaders: headers,
      mappedHeaders: mapping,
      missingHeaders: missing,
      importedRows: data.length,
      summary,
      status: 'Imported',
    });
    res.json({ success: true, data: { importedRows: data.length, targetSheetName: sheetName, summary, mapping, missing } });
  } catch (err) {
    await GoogleSheetImport.create({ tenantId: req.tenantId, userId: req.user.userId, userName: req.user.name || req.user.email, targetSection: req.body?.targetSection || 'unknown', spreadsheetId: req.body?.spreadsheetId || req.body?.spreadsheetUrl || 'unknown', spreadsheetUrl: req.body?.spreadsheetUrl, sheetName: req.body?.sheetName, range: req.body?.range, status: 'Failed', error: err.message }).catch(() => {});
    res.status(400).json({ success: false, message: err.message });
  }
};

const history = async (req, res) => {
  const data = await GoogleSheetImport.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, data });
};

module.exports = { listSections, preview, importFromGoogleSheet, history };
