const crypto = require('crypto');
const axios = require('axios');
const XLSX = require('xlsx');

const SECTION_TO_SHEET = {
  items: 'Items',
  vendors: 'Vendors',
  users: 'Users',
  foundries: 'FoundriesDepartments',
  fms: 'FmsTemplates',
  budgets: 'Budgets',
  requisitions: 'Requisitions',
  outwards: 'Outwards',
  indents: 'Indents',
  purchase_orders: 'PurchaseOrders',
  grn: 'GoodsReceipts',
  holidays: 'Holidays',
  floor_balances: 'Floor Material Left',
  costing_metrics: 'Production Metrics',
  costing_manual: 'Manual Cost Rows',
  costing_sales: 'Cost of Sales Rows',
};

const REQUIRED = {
  Items: ['SKU CODE', 'Item Name', 'FOUNDRY', 'DEPARTMENT', 'UOM'],
  Vendors: ['Vendor Name', 'Vendor Code'],
  Users: ['Name', 'Email'],
  FoundriesDepartments: ['FOUNDRY', 'DEPARTMENT'],
  FmsTemplates: ['FMS Type', 'What', 'Who', 'How'],
  Budgets: ['Month', 'FOUNDRY', 'DEPARTMENT', 'SKU CODE', 'Consumption per Kg / Per Month', 'Estimated Casting Qty'],
  Requisitions: ['Requisition No', 'FOUNDRY', 'DEPARTMENT', 'SKU CODE', 'Required Quantity'],
  Outwards: ['Outward No', 'FOUNDRY', 'DEPARTMENT', 'SKU CODE', 'Outward Qty'],
  Indents: ['Indent No', 'Indent Date', 'FOUNDRY', 'DEPARTMENT', 'SKU CODE', 'Required Quantity'],
  PurchaseOrders: ['PO No', 'Vendor Name', 'SKU CODE', 'Ordered Qty', 'Rate'],
  GoodsReceipts: ['PO No', 'Sub PO No', 'SKU CODE', 'Actual Receipt Date', 'Invoice / Bill Qty', 'Physical Received Qty'],
  Holidays: ['Year', 'Holiday Date', 'Holiday Name'],
  'Floor Material Left': ['Month', 'FOUNDRY', 'DEPARTMENT', 'SKU CODE', 'Floor Left Qty'],
  'Production Metrics': ['Month', 'Costing Type', 'Good Casting Wt MT'],
  'Manual Cost Rows': ['Month', 'Costing Type', 'Section', 'Item / Cost Head', 'Qty', 'Rate'],
  'Cost of Sales Rows': ['Month', 'Costing Type', 'Item / Sales Cost', 'Qty', 'Rate'],
};

const OPTIONAL = {
  Items: [
    'Code', 'Item Type', 'Mother Item', 'Product Category', 'HSN Code', 'GST %',
    'Daily Avg Consumption Low', 'Daily Avg Consumption Normal', 'Daily Avg Consumption Peak',
    'Current Season', 'Lead Time', 'Safety Factor', 'Max Level', 'Opening Stock Qty',
    'Current Qty', 'Total Available Quantity', 'Available Qty', 'Qty In Department',
    'Available %', 'Secondary UOM', 'Secondary Formula', 'Outward Form',
    'Inter Department Transfer Quantity', 'Item To Be Ordered', 'Rate', 'Total Cost',
    'Vendor Name', 'Sale Price', 'Profit %', 'Budget Sheet Qty', 'Outward Qty',
    'Send Monthly Stock Statement', 'Document Link', 'Active'
  ],
};

const ALIASES = {
  'SKU CODE': ['sku code', 'sku_code', 'sku', 'store sku', 'item sku', 'item code', 'store code', 'material code'],
  'Item Name': ['item', 'item name', 'item description', 'description', 'material', 'material name', 'particulars'],
  'FOUNDRY': ['foundry', 'unit', 'division', 'plant'],
  'DEPARTMENT': ['department', 'deptartment', 'dept', 'dept name', 'department name', 'section'],
  'UOM': ['uom', 'unit', 'unit of measure', 'primary uom'],
  'Code': ['code', 'sl no', 'serial no'],
  'Item Type': ['item type', 'type of item', 'type', 'product type'],
  'Mother Item': ['mother item', 'choose mother item from here', 'mother item name', 'group item', 'item group'],
  'Product Category': ['product category', 'category', 'preference category'],
  'HSN Code': ['hsn code', 'hsn'],
  'GST %': ['gst %', 'gst', 'gst percent', 'gst rate'],
  'Daily Avg Consumption Low': ['daily avg consumption low', 'daily average consumption low', 'low consumption'],
  'Daily Avg Consumption Normal': ['daily avg consumption normal', 'daily average consumption normal', 'normal consumption'],
  'Daily Avg Consumption Peak': ['daily avg consumption peak', 'daily average consumption peak', 'peak consumption'],
  'Current Season': ['current season', 'season'],
  'Lead Time': ['lead time', 'lead time days'],
  'Safety Factor': ['safety factor'],
  'Max Level': ['max level', 'maximum level'],
  'Opening Stock Qty': ['opening stock quantity', 'opening stock qty', 'opening stock'],
  'Current Qty': ['total available quantity', 'available qty', 'available quantity', 'current qty', 'current stock', 'qty in department'],
  'Total Available Quantity': ['total available quantity', 'total available qty'],
  'Available Qty': ['available qty', 'available quantity'],
  'Qty In Department': ['qty in department', 'department qty'],
  'Available %': ['available in %', 'available percent', 'available %'],
  'Secondary UOM': ['secondary uom', 'second uom'],
  'Secondary Formula': ['formula for calculating secondary uom to primary uom', 'secondary formula', 'secondary uom formula'],
  'Outward Form': ['outward form'],
  'Inter Department Transfer Quantity': ['inter department transfer quantity', 'inter department transfer qty'],
  'Item To Be Ordered': ['item to be ordered'],
  'Total Cost': ['total cost'],
  'Sale Price': ['sale price'],
  'Profit %': ['profit%', 'profit %', 'profit percent'],
  'Budget Sheet Qty': ['budget sheet qty'],
  'Send Monthly Stock Statement': ['choose yes to send data in monthly stock statement', 'send monthly stock statement', 'monthly stock statement'],
  'Document Link': ['document link'],
  'Vendor Name': ['vendor', 'vendor name', 'supplier', 'supplier name', 'party name'],
  'Vendor Code': ['vendor code', 'supplier code', 'party code'],
  'Name': ['name', 'user name', 'employee name'],
  'Email': ['email', 'mail', 'email address'],
  'Phone': ['phone', 'mobile', 'contact', 'contact no'],
  'WhatsApp': ['whatsapp', 'whatsapp no'],
  'FMS Type': ['fms type', 'type', 'workflow type'],
  'What': ['what', 'job', 'task', 'step', 'activity'],
  'Who': ['who', 'responsible', 'owner'],
  'How': ['how', 'method', 'process', 'checklist'],
  'When / TAT': ['when', 'tat', 'time allowed', 'timeline'],
  'Month': ['month', 'budget month', 'costing month'],
  'Consumption per Kg / Per Month': ['consumption per kg per month', 'consumption per kg / per month', 'consumption', 'consumption per kg', 'per kg per month'],
  'Estimated Casting Qty': ['estimated casting qty', 'estimated casting quantity', 'casting qty', 'estimated production'],
  'Required Quantity': ['required qty', 'required quantity', 'reqd quantity', 'qty required', 'indent qty'],
  'Outward Qty': ['outward qty', 'issue qty', 'issued qty', 'consume qty'],
  'Ordered Qty': ['ordered qty', 'order qty', 'po qty', 'quantity'],
  'Rate': ['rate', 'unit rate', 'price', 'last purchase rate'],
  'PO No': ['po no', 'p o no', 'po number', 'purchase order no'],
  'Sub PO No': ['sub po', 'sub po no', 'line po no'],
  'Indent No': ['indent no', 'indent number'],
  'Indent Date': ['indent date', 'date'],
  'Requisition No': ['requisition no', 'requisition number', 'req no'],
  'Outward No': ['outward no', 'issue no'],
  'Actual Receipt Date': ['actual receipt date', 'receipt date', 'receive date', 'received date', 'grn date'],
  'Invoice / Bill Qty': ['invoice qty', 'bill qty', 'invoice / bill qty', 'challan qty'],
  'Physical Received Qty': ['physical received qty', 'received qty', 'actual qty', 'physical qty'],
  'Holiday Date': ['holiday date', 'date'],
  'Holiday Name': ['holiday name', 'holiday', 'name'],
  'Floor Left Qty': ['floor left qty', 'material left', 'left on floor', 'balance on floor', 'floor balance'],
  'Costing Type': ['costing type', 'type', 'process'],
  'Good Casting Wt MT': ['good casting wt mt', 'good casting wt', 'good casting', 'good casting weight'],
  'Section': ['section', 'cost section', 'cost head group'],
  'Item / Cost Head': ['item / cost head', 'item cost head', 'cost head', 'item name'],
  'Item / Sales Cost': ['item / sales cost', 'sales cost', 'cost head', 'item name'],
  'Qty': ['qty', 'quantity', 'consumed qty'],
};

const normalize = (v) => String(v || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const b64url = (input) => Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function extractSpreadsheetId(input) {
  const s = String(input || '').trim();
  if (!s) throw new Error('Spreadsheet URL or ID is required');
  const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) || s.match(/id=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : s;
}

function buildRange(sheetName, range) {
  const cleanSheet = String(sheetName || '').trim();
  const cleanRange = String(range || '').trim();
  if (!cleanSheet && !cleanRange) throw new Error('Sheet name or range is required');
  if (cleanRange.includes('!')) return cleanRange;
  if (!cleanRange) return `'${cleanSheet.replace(/'/g, "''")}'`;
  if (!cleanSheet) return cleanRange;
  return `'${cleanSheet.replace(/'/g, "''")}'!${cleanRange}`;
}

async function getServiceAccountToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return '';
  key = key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = { iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(key);
  const assertion = `${signingInput}.${b64url(signature)}`;
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const { data } = await axios.post('https://oauth2.googleapis.com/token', body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 });
  return data.access_token;
}

async function fetchSheetValues({ spreadsheetUrl, spreadsheetId, sheetName, range }) {
  const id = extractSpreadsheetId(spreadsheetId || spreadsheetUrl);
  const a1 = buildRange(sheetName, range);
  const encodedRange = encodeURIComponent(a1);
  const token = await getServiceAccountToken();
  const key = token ? '' : (process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY || '');
  console.log('Google Sheets auth mode:', token ? 'SERVICE_ACCOUNT' : key ? 'API_KEY' : 'NONE');
  console.log('Google Sheets spreadsheet:', id);
  console.log('Google Sheets range:', a1);
  if (!token && !key) throw new Error('Configure GOOGLE_SHEETS_API_KEY for public sheets or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY for private sheets. Share the Sheet with the service-account email.');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodedRange}${token ? '' : `?key=${encodeURIComponent(key)}`}`;
  try {
    const { data } = await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 60000 });
    return { spreadsheetId: id, range: data.range, values: data.values || [] };
  } catch (err) {
    const googleError = err.response?.data?.error;
    if (googleError?.code === 403) {
      throw new Error(`Google Sheets permission denied. Auth mode: ${token ? 'SERVICE_ACCOUNT' : 'API_KEY'}. If this is private, share the sheet with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'the service account email'}.`);
    }
    throw err;
  }
}

function detectHeaderRow(values, forced) {
  if (!values.length) return 0;
  if (forced && Number(forced) > 0) return Number(forced) - 1;
  let best = 0;
  let bestScore = -1;
  values.slice(0, 10).forEach((row, idx) => {
    const cells = (row || []).map(normalize).filter(Boolean);
    const labelHits = cells.filter((c) => Object.values(ALIASES).flat().some((a) => c === normalize(a) || c.includes(normalize(a)) || normalize(a).includes(c))).length;
    const score = cells.length + labelHits * 3;
    if (score > bestScore) { best = idx; bestScore = score; }
  });
  return best;
}

function mapHeaders(sourceHeaders, targetSheetName) {
  const requiredHeaders = REQUIRED[targetSheetName] || [];
  const targetHeaders = [...new Set([...requiredHeaders, ...(OPTIONAL[targetSheetName] || [])])];
  const normalizedSources = sourceHeaders.map((h, i) => ({ raw: String(h || '').trim(), norm: normalize(h), index: i }));
  const mapped = {};
  const used = new Set();

  targetHeaders.forEach((target) => {
    const targetNorm = normalize(target);

    // 1) Exact header name gets first priority. This prevents "Code" being selected instead of "SKU CODE".
    let hit = normalizedSources.find((s) => !used.has(s.index) && s.norm === targetNorm);

    // 2) Exact aliases next.
    if (!hit) {
      const aliases = (ALIASES[target] || []).map(normalize).filter(Boolean);
      hit = normalizedSources.find((s) => !used.has(s.index) && aliases.includes(s.norm));
    }

    // 3) Controlled fuzzy match last. Avoid mapping generic Code to SKU CODE when SKU CODE header exists.
    if (!hit) {
      const aliases = (ALIASES[target] || []).map(normalize).filter(Boolean).filter((a) => !(target === 'SKU CODE' && a === 'code'));
      hit = normalizedSources.find((s) => !used.has(s.index) && aliases.some((a) => s.norm.includes(a) || a.includes(s.norm)));
    }

    if (hit) { mapped[target] = hit.raw; used.add(hit.index); }
  });

  // Keep extra columns also by original header name so import utility can use them if matched.
  normalizedSources.forEach((s) => { if (!Object.values(mapped).includes(s.raw) && s.raw) mapped[s.raw] = s.raw; });
  const missing = requiredHeaders.filter((h) => !mapped[h]);
  return { mapped, missing, targetHeaders };
}

function parseRows(values, headerRowIndex, dateColumn, fromDate, toDate) {
  const headers = values[headerRowIndex] || [];
  let rows = values.slice(headerRowIndex + 1).map((row) => {
    const out = {};
    headers.forEach((h, i) => { out[String(h || '').trim()] = row[i] ?? ''; });
    return out;
  }).filter((r) => Object.values(r).some((v) => String(v || '').trim()));
  if (dateColumn && (fromDate || toDate)) {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    rows = rows.filter((r) => {
      const d = new Date(r[dateColumn]);
      if (Number.isNaN(d.getTime())) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  return { headers, rows };
}

function buildWorkbookFromRows(targetSection, rows, mappedHeaders) {
  const sheetName = SECTION_TO_SHEET[targetSection];
  if (!sheetName) throw new Error(`Unsupported Google Sheet import section: ${targetSection}`);
  const targets = REQUIRED[sheetName] || [];
  const allTargets = [...new Set([...targets, ...Object.keys(mappedHeaders).filter((k) => !targets.includes(k))])];
  const data = rows.map((r) => {
    const out = {};
    allTargets.forEach((target) => {
      const source = mappedHeaders[target] || target;
      out[target] = r[source] ?? '';
    });
    return out;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data, { header: allTargets }), sheetName);
  return { wb, sheetName, data };
}

async function previewGoogleSheet(payload) {
  const targetSection = payload.targetSection || 'items';
  const targetSheetName = SECTION_TO_SHEET[targetSection];
  if (!targetSheetName) throw new Error('Select a valid target section');
  const fetched = await fetchSheetValues(payload);
  const headerRowIndex = detectHeaderRow(fetched.values, payload.headerRow);
  const { headers, rows } = parseRows(fetched.values, headerRowIndex, payload.dateColumn, payload.fromDate, payload.toDate);
  const { mapped, missing, targetHeaders } = mapHeaders(headers, targetSheetName);
  return { ...fetched, targetSection, targetSheetName, headerRow: headerRowIndex + 1, detectedHeaders: headers, mappedHeaders: mapped, missingHeaders: missing, targetHeaders, totalRows: rows.length, sampleRows: rows.slice(0, 10) };
}

module.exports = { SECTION_TO_SHEET, previewGoogleSheet, buildWorkbookFromRows, parseRows, mapHeaders, fetchSheetValues, detectHeaderRow, extractSpreadsheetId };
