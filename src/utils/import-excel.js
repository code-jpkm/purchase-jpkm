require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Tenant = require('../models/Tenant.schema');
const User = require('../models/User.schema');
const Foundry = require('../models/Foundry-dept.schema');
const Vendor = require('../models/Vendor.schema');
const StoreItem = require('../models/Store-item.schema');
const Uom = require('../models/Uom.schema');
const MotherItem = require('../models/Mother-item.schema');
const FmsTemplate = require('../models/Fms-template.schema');
const Budget = require('../models/Budget.schema');
const Requisition = require('../models/Requisition.schema');
const StoreOutward = require('../models/Store-outward.schema');
const Indent = require('../models/Indent.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const HolidayCalendar = require('../models/Holiday-calendar.schema');
const CostingRun = require('../models/Costing-run.schema');
const FloorMaterialBalance = require('../models/Floor-material-balance.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const { ensureFmsTemplates, buildFmsStages, syncAllOpenTasks } = require('../services/fms.service');
const { fetchHolidayDates } = require('./business-time');
const { getFiscalYear, getMonthLabel, getPeriodDates } = require('./fiscal');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'jpk_store';
const TENANT_CODE = (process.env.SEED_TENANT_CODE || 'JPKM').trim().toUpperCase();

const ALL_PERMISSIONS = [
  '*', 'store:read', 'store:write', 'store:admin', 'inventory:read', 'inventory:write',
  'indent:read', 'indent:write', 'purchase:read', 'purchase:write', 'purchase:admin',
  'po:read', 'po:write', 'grn:read', 'grn:write', 'outward:read', 'outward:write',
  'requisition:read', 'requisition:write', 'budget:read', 'budget:write', 'budget:approve',
  'stock_statement:read', 'stock_statement:write', 'vendor:read', 'vendor:write', 'vendor:admin',
  'foundry:read', 'foundry:write', 'holiday:read', 'holiday:write', 'fms:read', 'fms:admin',
  'user:read', 'user:write', 'help:read', 'help:write', 'ai:use', 'costing:read', 'costing:write', 'reports:read'
];

const normalizeHeader = (value) => String(value || '')
  .toLowerCase()
  .replace(/\([^)]*\)/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+(.)/g, (_, c) => c.toUpperCase());

const alias = {
  skuCode: ['sku', 'skuCode', 'itemSkuCode', 'storeCode', 'materialCode'],
  code: ['slNo', 'serialNo'],
  itemName: ['item', 'itemName', 'itemDescription', 'materialName', 'description'],
  vendorName: ['vendor', 'vendorName', 'vendorNameAddress', 'supplierName'],
  vendorCode: ['vendorCode', 'vendorId', 'supplierCode'],
  foundry: ['foundry', 'unit', 'division'],
  department: ['department', 'deptartment', 'dept', 'deptName', 'departmentName'],
  uom: ['uom', 'unit', 'primaryUom'],
  secondaryUom: ['secondaryUom', 'secondUom'],
  secondaryFormula: ['secondaryFormula', 'secondaryUomFormula', 'formulaForCalculatingSecondaryUomToPrimaryUom'],
  itemType: ['itemType', 'typeOfItem', 'type'],
  motherItem: ['motherItem', 'chooseMotherItemFromHere', 'motherItemName', 'itemGroup', 'groupItem'],
  hsnCode: ['hsnCode', 'hsn'],
  gstPercent: ['gstPercent', 'gst', 'gstRate'],
  currentSeason: ['currentSeason', 'season'],
  dailyAvgConsumptionLow: ['dailyAvgConsumptionLow', 'dailyAverageConsumptionLow'],
  dailyAvgConsumptionNormal: ['dailyAvgConsumptionNormal', 'dailyAverageConsumptionNormal'],
  dailyAvgConsumptionPeak: ['dailyAvgConsumptionPeak', 'dailyAverageConsumptionPeak'],
  leadTime: ['leadTime', 'leadTimeDays'],
  safetyFactor: ['safetyFactor'],
  maxLevel: ['maxLevel', 'maximumLevel'],
  openingStockQty: ['openingStockQty', 'openingStockQuantity', 'openingStock'],
  currentQty: ['currentQty', 'currentStock', 'totalAvailableQuantity', 'availableQty', 'availableQuantity', 'qtyInDepartment'],
  qtyInDepartment: ['qtyInDepartment', 'departmentQty'],
  interDeptTransferQty: ['interDeptTransferQty', 'interDepartmentTransferQuantity'],
  sendMonthlyStockStatement: ['sendMonthlyStockStatement', 'sendToMonthlyStock', 'chooseYesToSendDataInMonthlyStockStatement'],
  documentLink: ['documentLink'],
  salePrice: ['salePrice'],
  profitPercent: ['profitPercent', 'profit'],
  totalCost: ['totalCost'],
  productCategory: ['productCategory'],
  preference: ['preference'],
  rate: ['rate', 'lastPurchaseRate'],
};

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v, d = 0) => {
  if (v === undefined || v === null || v === '') return d;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : d;
};
const bool = (v, d = false) => {
  const s = clean(v).toLowerCase();
  if (!s) return d;
  return ['yes', 'y', 'true', '1', 'active'].includes(s);
};
const splitList = (v) => clean(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
const dateVal = (v, d = undefined) => {
  if (!v) return d;
  if (v instanceof Date) return v;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? d : parsed;
};
const foundryVal = (v) => {
  const s = clean(v).toUpperCase().replace(/\s/g, '');
  if (['DI', 'D.I', 'D.I.', 'DUCTILEIRON'].includes(s)) return 'D. I';
  if (['CI', 'C.I', 'C.I.', 'CASTIRON'].includes(s)) return 'C. I';
  return clean(v) || 'D. I';
};
const statusVal = (v, d) => clean(v) || d;

const rows = (wb, sheetName) => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  return raw.map((r) => {
    const out = {};
    Object.keys(r).forEach((k) => { out[normalizeHeader(k)] = r[k]; });
    return out;
  }).filter((r) => Object.values(r).some((v) => clean(v)));
};
const get = (r, ...keys) => {
  for (const k of keys) {
    if (r[k] !== undefined && clean(r[k]) !== '') return r[k];
    for (const a of (alias[k] || [])) if (r[a] !== undefined && clean(r[a]) !== '') return r[a];
  }
  return undefined;
};

async function ensureTenant() {
  let tenant = await Tenant.findOne({ code: TENANT_CODE });
  if (!tenant) tenant = new Tenant({ code: TENANT_CODE });
  tenant.name = tenant.name || 'JPK Metals';
  tenant.status = 'active';
  tenant.countryCode = tenant.countryCode || 'IN';
  tenant.timezone = tenant.timezone || 'Asia/Kolkata';
  tenant.fiscalYearStart = tenant.fiscalYearStart || '04-01';
  tenant.isDeleted = false;
  tenant.deletedAt = undefined;
  await tenant.save();
  await ensureFmsTemplates(tenant._id);
  return tenant;
}

async function ensureAdmin(tenant) {
  const email = (process.env.SEED_EMAIL || 'admin@jpkmetals.com').toLowerCase();
  const password = process.env.SEED_PASSWORD || 'Admin@123';
  const passwordHash = await bcrypt.hash(password, 12);
  await User.findOneAndUpdate(
    { tenantId: tenant._id, email },
    { tenantId: tenant._id, name: 'Admin', email, passwordHash, role: 'super_admin', permissions: ALL_PERMISSIONS, isActive: true, isDeleted: false },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function nextNumber(tenantId, type, date, prefixBase) {
  const fy = getFiscalYear(date || new Date());
  const prefix = `${prefixBase}/${fy}`;
  const n = await StoreSequence.nextSeq(tenantId, type, fy, prefix);
  return { fiscalYear: fy, seq: n, no: `${prefix}/${n}` };
}

async function importFoundries(tenant, data) {
  const byFoundry = new Map();
  data.forEach((r) => {
    const foundry = foundryVal(get(r, 'foundry'));
    const code = clean(get(r, 'foundryCode')) || (foundry === 'D. I' ? 'DI' : 'CI');
    const key = code;
    if (!byFoundry.has(key)) byFoundry.set(key, { name: foundry, fullName: clean(get(r, 'foundryFullName')) || foundry, code, departments: [] });
    const dept = clean(get(r, 'department', 'deptName'));
    if (dept) byFoundry.get(key).departments.push({
      name: dept,
      code: clean(get(r, 'departmentCode')) || dept.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12),
      hodName: clean(get(r, 'hodName')),
      hodEmail: clean(get(r, 'hodEmail')),
      hodWhatsApp: clean(get(r, 'hodWhatsApp')),
      budgetAlertEmails: splitList(get(r, 'budgetAlertEmails')),
      budgetAlertWhatsApp: splitList(get(r, 'budgetAlertWhatsApp')),
      isActive: bool(get(r, 'active'), true),
    });
  });
  let count = 0;
  for (const f of byFoundry.values()) {
    const existing = await Foundry.findOne({ tenantId: tenant._id, code: f.code });
    const deptMap = new Map((existing?.departments || []).map((d) => [String(d.name).toUpperCase(), d.toObject ? d.toObject() : d]));
    f.departments.forEach((d) => deptMap.set(String(d.name).toUpperCase(), d));
    await Foundry.findOneAndUpdate({ tenantId: tenant._id, code: f.code }, { tenantId: tenant._id, ...f, departments: [...deptMap.values()], isActive: true, isDeleted: false }, { upsert: true });
    count += f.departments.length || 1;
  }
  return count;
}

async function importUsers(tenant, data) {
  let count = 0;
  for (const r of data) {
    const email = clean(get(r, 'email')).toLowerCase();
    if (!email) continue;
    const password = clean(get(r, 'password')) || 'User@123';
    const passwordHash = await bcrypt.hash(password, 12);
    await User.findOneAndUpdate(
      { tenantId: tenant._id, email },
      {
        tenantId: tenant._id,
        name: clean(get(r, 'name')) || email.split('@')[0],
        email,
        phone: clean(get(r, 'phone')),
        whatsapp: clean(get(r, 'whatsapp')) || clean(get(r, 'phone')),
        passwordHash,
        role: clean(get(r, 'role')) || 'department_user',
        permissions: splitList(get(r, 'permissions')),
        foundry: clean(get(r, 'foundry')) ? foundryVal(get(r, 'foundry')) : null,
        department: clean(get(r, 'department')),
        isActive: bool(get(r, 'active'), true),
        isDeleted: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count += 1;
  }
  return count;
}

async function importVendors(tenant, data) {
  let count = 0;
  for (const r of data) {
    const name = clean(get(r, 'vendorName', 'name'));
    if (!name) continue;
    const vendorCode = (clean(get(r, 'vendorCode')) || `VEN-${String(count + 1).padStart(4, '0')}`).toUpperCase();
    await Vendor.findOneAndUpdate(
      { tenantId: tenant._id, vendorCode },
      {
        tenantId: tenant._id,
        vendorCode,
        name,
        kindAttention: clean(get(r, 'kindAttn', 'kindAttention')),
        contactPerson: clean(get(r, 'contactPerson')),
        email: clean(get(r, 'email')).toLowerCase(),
        phone: clean(get(r, 'phone')),
        whatsapp: clean(get(r, 'whatsapp')),
        gstNo: clean(get(r, 'gstin', 'gstNo')).toUpperCase(),
        panNo: clean(get(r, 'panNo')).toUpperCase(),
        address: {
          line1: clean(get(r, 'addressLine1')),
          line2: clean(get(r, 'addressLine2')),
          city: clean(get(r, 'city')),
          state: clean(get(r, 'state')),
          pincode: clean(get(r, 'pincode')),
          country: clean(get(r, 'country')) || 'India',
        },
        paymentTerms: clean(get(r, 'paymentTerms')) || '30 days',
        avgLeadTimeDays: num(get(r, 'avgLeadTimeDays'), 7),
        rating: Math.min(5, Math.max(1, num(get(r, 'rating'), 3))),
        categories: splitList(get(r, 'categories')),
        isActive: bool(get(r, 'active'), true),
        isDeleted: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count += 1;
  }
  return count;
}


const allowedItemTypes = ['Raw Material', 'Chemical', 'Packing Material', 'Hard Coke', 'Paint', 'Stores', 'Grinding Wheel', 'Fire Wood', 'Lime Stone', 'Repair', 'Capital'];
const canonicalItemType = (value) => {
  const raw = clean(value);
  if (!raw) return 'Stores';
  const norm = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hit = allowedItemTypes.find((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === norm);
  if (hit) return hit;
  if (norm.includes('chemical')) return 'Chemical';
  if (norm.includes('raw')) return 'Raw Material';
  if (norm.includes('packing')) return 'Packing Material';
  if (norm.includes('grinding')) return 'Grinding Wheel';
  if (norm.includes('paint')) return 'Paint';
  if (norm.includes('coke')) return 'Hard Coke';
  if (norm.includes('wood')) return 'Fire Wood';
  if (norm.includes('lime')) return 'Lime Stone';
  if (norm.includes('repair')) return 'Repair';
  if (norm.includes('capital')) return 'Capital';
  return 'Stores';
};
const skuSuffixNumber = (sku) => {
  const m = clean(sku).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
};
async function ensureUom(tenantId, code) {
  const c = clean(code).toUpperCase();
  if (!c) return null;
  return Uom.findOneAndUpdate(
    { tenantId, code: c },
    { tenantId, code: c, name: c, isActive: true, isDeleted: false },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
async function ensureMotherItem(tenantId, name, itemType) {
  const n = clean(name).toUpperCase();
  if (!n) return null;
  return MotherItem.findOneAndUpdate(
    { tenantId, name: n },
    { tenantId, name: n, itemType: canonicalItemType(itemType), isActive: true, isDeleted: false },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
function mergeStockRows(rowsForSku, first) {
  const map = new Map();
  rowsForSku.forEach((r) => {
    const foundry = foundryVal(get(r, 'foundry'));
    const department = clean(get(r, 'department'));
    if (!department) return;
    const key = `${foundry}|${department.toUpperCase()}`;
    const opening = num(get(r, 'openingStockQty'));
    const current = num(get(r, 'currentQty'), opening);
    const qtyDept = num(get(r, 'qtyInDepartment'), current);
    const existing = map.get(key);
    const stock = {
      foundry,
      department,
      currentSeason: clean(get(r, 'currentSeason')) || 'Normal',
      dailyAvgConsumptionLow: num(get(r, 'dailyAvgConsumptionLow')),
      dailyAvgConsumptionNormal: num(get(r, 'dailyAvgConsumptionNormal')),
      dailyAvgConsumptionPeak: num(get(r, 'dailyAvgConsumptionPeak')),
      leadTime: num(get(r, 'leadTime')),
      safetyFactor: num(get(r, 'safetyFactor'), 1),
      maxLevel: num(get(r, 'maxLevel')),
      openingStockQty: opening,
      currentQty: current,
      outwardFormType: 'OUTWARD FORM',
      interDeptTransferFormType: 'INTER DEPARTMENT TRANSFER FORM',
      interDeptTransferQty: num(get(r, 'interDeptTransferQty')),
      qtyInDepartment: qtyDept,
      documentLink: clean(get(r, 'documentLink')),
      sendToMonthlyStock: bool(get(r, 'sendMonthlyStockStatement'), bool(get(r, 'sendToMonthlyStock'))),
      motherItem: clean(get(r, 'motherItem')) || clean(get(first, 'motherItem')) || clean(get(first, 'itemName')),
    };
    if (existing) {
      existing.openingStockQty += stock.openingStockQty;
      existing.currentQty += stock.currentQty;
      existing.qtyInDepartment += stock.qtyInDepartment;
      existing.maxLevel = Math.max(existing.maxLevel || 0, stock.maxLevel || 0);
      existing.sendToMonthlyStock = existing.sendToMonthlyStock || stock.sendToMonthlyStock;
      if (!existing.documentLink && stock.documentLink) existing.documentLink = stock.documentLink;
    } else {
      map.set(key, stock);
    }
  });
  return [...map.values()];
}
async function importItems(tenant, data) {
  const grouped = new Map();
  let autoSeq = 0;
  for (const r of data) {
    let skuCode = clean(get(r, 'skuCode')).toUpperCase();
    const itemName = clean(get(r, 'itemName'));
    if (!itemName) continue;
    if (!skuCode || skuCode === 'AUTO') {
      autoSeq += 1;
      skuCode = `AUTO_IMPORT_${String(autoSeq).padStart(6, '0')}`;
    }
    if (!grouped.has(skuCode)) grouped.set(skuCode, { rows: [], first: r });
    grouped.get(skuCode).rows.push(r);
  }

  let count = 0;
  let maxImportedSkuNo = 0;

  for (const [rawSkuCode, group] of grouped) {
    const first = group.first;
    let skuCode = rawSkuCode;
    if (skuCode.startsWith('AUTO_IMPORT_')) {
      const seq = await StoreSequence.nextSeq(tenant._id, 'STORE_ITEM', 'MASTER', 'JPK/STOR');
      skuCode = `JPK/STOR/${String(seq).padStart(3, '0')}`;
    }
    maxImportedSkuNo = Math.max(maxImportedSkuNo, skuSuffixNumber(skuCode));

    const itemType = canonicalItemType(get(first, 'itemType'));
    const motherName = clean(get(first, 'motherItem')) || clean(get(first, 'itemName'));
    const uomCode = (clean(get(first, 'uom')) || 'PCS').toUpperCase();
    const secondaryUomCode = clean(get(first, 'secondaryUom')).toUpperCase();

    const [uomDoc, secondaryUomDoc, motherDoc] = await Promise.all([
      ensureUom(tenant._id, uomCode),
      secondaryUomCode ? ensureUom(tenant._id, secondaryUomCode) : null,
      ensureMotherItem(tenant._id, motherName, itemType),
    ]);

    const vendorCode = clean(get(first, 'vendorCode')).toUpperCase();
    let vendor = vendorCode ? await Vendor.findOne({ tenantId: tenant._id, vendorCode }) : null;
    const vendorName = clean(get(first, 'vendorName'));
    if (!vendor && vendorName) {
      vendor = await Vendor.findOneAndUpdate(
        { tenantId: tenant._id, name: { $regex: `^${vendorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { tenantId: tenant._id, vendorCode: `VEN-${String(Math.abs(vendorName.split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 100000).padStart(5,'0')}`, name: vendorName, isActive: true, isDeleted: false },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const stocks = mergeStockRows(group.rows, first);
    const totalAvailableQty = stocks.reduce((s, x) => s + num(x.currentQty), 0);
    const rate = num(get(first, 'rate'));

    await StoreItem.findOneAndUpdate(
      { tenantId: tenant._id, skuCode },
      {
        tenantId: tenant._id,
        code: num(get(first, 'code')) || skuSuffixNumber(skuCode) || undefined,
        skuCode,
        itemName: clean(get(first, 'itemName')),
        itemType,
        motherItemId: motherDoc?._id,
        motherItem: motherDoc?.name || motherName.toUpperCase(),
        hsnCode: clean(get(first, 'hsnCode')),
        gstPercent: num(get(first, 'gstPercent')),
        uomId: uomDoc?._id,
        uom: uomCode,
        secondaryUomId: secondaryUomDoc?._id,
        secondaryUom: secondaryUomCode,
        secondaryUomFormula: clean(get(first, 'secondaryFormula', 'secondaryUomFormula')),
        productCategory: clean(get(first, 'productCategory')) || (itemType === 'Chemical' ? 'CHEMICAL' : 'STORE'),
        preference: num(get(first, 'preference'), itemType === 'Chemical' ? 1 : 2),
        rate,
        salePrice: num(get(first, 'salePrice')),
        profitPercent: num(get(first, 'profitPercent')),
        lastVendorId: vendor?._id,
        lastVendorName: vendor?.name || vendorName,
        totalAvailableQty,
        stocks,
        isActive: bool(get(first, 'active'), true),
        isDeleted: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count += 1;
  }

  if (maxImportedSkuNo > 0) {
    await StoreSequence.findOneAndUpdate(
      { tenantId: tenant._id, type: 'STORE_ITEM', fiscalYear: 'MASTER' },
      { $max: { currentSeq: maxImportedSkuNo }, $setOnInsert: { prefix: 'JPK/STOR' } },
      { upsert: true, new: true }
    );
  }

  return count;
}

async function importFmsTemplates(tenant, data) {
  if (!data.length) return 0;
  const grouped = new Map();
  data.forEach((r) => {
    const flowType = clean(get(r, 'flowType')).toLowerCase();
    if (!['indent', 'po', 'grn'].includes(flowType)) return;
    if (!grouped.has(flowType)) grouped.set(flowType, []);
    grouped.get(flowType).push(r);
  });
  let count = 0;
  for (const [flowType, list] of grouped) {
    const steps = [];
    for (const r of list.sort((a, b) => num(get(a, 'stepOrder')) - num(get(b, 'stepOrder')))) {
      const assignedEmail = clean(get(r, 'assignedUserEmail')).toLowerCase();
      const assigned = assignedEmail ? await User.findOne({ tenantId: tenant._id, email: assignedEmail }) : null;
      const what = clean(get(r, 'what'));
      if (!what) continue;
      steps.push({
        key: clean(get(r, 'stepKey')) || what.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
        order: num(get(r, 'stepOrder'), steps.length + 1),
        what,
        who: clean(get(r, 'who')),
        how: clean(get(r, 'how')),
        assignedUserId: assigned?._id,
        assignedUserName: assigned?.name,
        assignedUserEmail: assigned?.email || assignedEmail,
        assignedUserWhatsapp: assigned?.whatsapp,
        tatDays: clean(get(r, 'tatDays')) === '' ? null : num(get(r, 'tatDays')),
        plannedMode: clean(get(r, 'plannedMode')) || 'tat',
        statusOptions: splitList(get(r, 'statusOptions')).length ? splitList(get(r, 'statusOptions')) : ['Pending', 'Yes', 'No', 'Hold', 'Skipped'],
        isActive: bool(get(r, 'active'), true),
      });
    }
    if (steps.length) {
      await FmsTemplate.findOneAndUpdate({ tenantId: tenant._id, flowType }, { tenantId: tenant._id, flowType, name: `${flowType.toUpperCase()} FMS`, steps, isActive: true, isDeleted: false }, { upsert: true });
      count += steps.length;
    }
  }
  return count;
}

async function findItem(tenantId, skuCode) {
  return StoreItem.findOne({ tenantId, skuCode: clean(skuCode).toUpperCase(), isDeleted: { $ne: true } });
}
async function findUser(tenantId, email) {
  const e = clean(email).toLowerCase();
  return e ? User.findOne({ tenantId, email: e }) : null;
}
async function findVendor(tenantId, codeOrName) {
  const q = clean(codeOrName);
  if (!q) return null;
  return Vendor.findOne({ tenantId, $or: [{ vendorCode: q.toUpperCase() }, { name: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }], isDeleted: { $ne: true } });
}

async function importBudgets(tenant, data) {
  const grouped = new Map();
  for (const r of data) {
    const year = num(get(r, 'year'), new Date().getFullYear());
    const month = num(get(r, 'month'), new Date().getMonth() + 1);
    const foundry = foundryVal(get(r, 'foundry'));
    const department = clean(get(r, 'department'));
    if (!department) continue;
    const key = `${year}|${month}|${foundry}|${department}`;
    if (!grouped.has(key)) grouped.set(key, { year, month, foundry, department, rows: [] });
    grouped.get(key).rows.push(r);
  }
  let count = 0;
  for (const g of grouped.values()) {
    const { periodStart, periodEnd } = getPeriodDates(g.year, g.month);
    const headEmail = clean(get(g.rows[0], 'departmentHeadEmail')).toLowerCase();
    const head = await findUser(tenant._id, headEmail);
    const lines = [];
    for (const r of g.rows) {
      const item = await findItem(tenant._id, get(r, 'skuCode'));
      const requiredQtyForMonth = num(get(r, 'requiredQtyForMonth'), num(get(r, 'consumptionPerKgPerMonth')) * num(get(r, 'estimatedCastingQty')));
      const finalOrderQty = num(get(r, 'finalOrderQty'), Math.max(requiredQtyForMonth - num(get(r, 'tentativeOpeningStock')), num(get(r, 'minimumOrderQty'))));
      const rate = num(get(r, 'rateAsPerLastPurchase'), item?.rate || 0);
      lines.push({
        slNo: lines.length + 1,
        foundry: g.foundry,
        department: g.department,
        skuCode: item?.skuCode || clean(get(r, 'skuCode')).toUpperCase(),
        storeItemId: item?._id,
        itemName: item?.itemName || clean(get(r, 'itemName')),
        itemType: item?.itemType || clean(get(r, 'itemType')) || 'Stores',
        motherItem: item?.motherItem || clean(get(r, 'motherItem')),
        uom: item?.uom || clean(get(r, 'uom')) || 'PCS',
        consumptionPerKgPerMonth: num(get(r, 'consumptionPerKgPerMonth')),
        estimatedCastingQty: num(get(r, 'estimatedCastingQty')),
        tentativeOpeningStock: num(get(r, 'tentativeOpeningStock')),
        avgMonthlyRequirement: num(get(r, 'averageMonthlyRequirement')),
        requiredQtyForMonth,
        minimumOrderQty: num(get(r, 'minimumOrderQty')),
        finalOrderQty,
        rateAsPerLastPurchase: rate,
        totalValue: finalOrderQty * rate,
        firstHalfQty: Math.ceil(finalOrderQty / 2),
        firstHalfValue: Math.ceil(finalOrderQty / 2) * rate,
        secondHalfQty: Math.max(0, finalOrderQty - Math.ceil(finalOrderQty / 2)),
        secondHalfValue: Math.max(0, finalOrderQty - Math.ceil(finalOrderQty / 2)) * rate,
      });
    }
    const totalBudgetValue = lines.reduce((s, l) => s + num(l.totalValue), 0);
    await Budget.findOneAndUpdate(
      { tenantId: tenant._id, year: g.year, month: g.month, foundry: g.foundry, department: g.department },
      { tenantId: tenant._id, year: g.year, month: g.month, monthLabel: getMonthLabel(g.year, g.month), foundry: g.foundry, department: g.department, departmentHeadUserId: head?._id, departmentHeadName: head?.name, departmentHeadEmail: head?.email || headEmail, departmentHeadWhatsapp: head?.whatsapp, periodStart, periodEnd, totalWorkingDays: num(get(g.rows[0], 'totalWorkingDays'), 27), lines, totalBudgetValue, status: statusVal(get(g.rows[0], 'submitStatus'), 'Draft') },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count += lines.length;
  }
  return count;
}

async function importRequisitions(tenant, data) {
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  for (const r of data) {
    const item = await findItem(tenant._id, get(r, 'skuCode'));
    if (!item) continue;
    const requester = await findUser(tenant._id, get(r, 'requestedByEmail')) || admin;
    const d = dateVal(get(r, 'requisitionDate'), new Date());
    const requisitionNo = clean(get(r, 'requisitionNo')) || (await nextNumber(tenant._id, 'REQUISITION', d, 'REQ')).no;
    const lineNo = num(get(r, 'lineNo'), 1);
    await Requisition.findOneAndUpdate({ tenantId: tenant._id, requisitionNo, lineNo }, {
      tenantId: tenant._id, requisitionNo, requisitionDate: d, lineNo, requestedBy: requester._id, requestorName: requester.name,
      foundry: foundryVal(get(r, 'foundry')), department: clean(get(r, 'department')), skuCode: item.skuCode, storeItemId: item._id, itemName: item.itemName, uom: item.uom,
      requestedQty: num(get(r, 'requestedQty')), issuedQty: num(get(r, 'issuedQty')), balanceQty: Math.max(0, num(get(r, 'requestedQty')) - num(get(r, 'issuedQty'))), purpose: clean(get(r, 'purpose')), status: statusVal(get(r, 'status'), 'Pending'), isDeleted: false,
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    count++;
  }
  return count;
}

async function importOutwards(tenant, data) {
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  for (const r of data) {
    const item = await findItem(tenant._id, get(r, 'skuCode'));
    if (!item) continue;
    const issuer = await findUser(tenant._id, get(r, 'issuedByEmail')) || admin;
    const d = dateVal(get(r, 'outwardDate'), new Date());
    const outwardNo = clean(get(r, 'outwardNo')) || (await nextNumber(tenant._id, clean(get(r, 'outwardType')) === 'INTER_DEPT_TRANSFER' ? 'IDT' : 'OUTWARD', d, clean(get(r, 'outwardType')) === 'INTER_DEPT_TRANSFER' ? 'IDT' : 'OUT')).no;
    const lineNo = num(get(r, 'lineNo'), 1);
    const requisitionNo = clean(get(r, 'requisitionNo'));
    const req = requisitionNo ? await Requisition.findOne({ tenantId: tenant._id, requisitionNo, skuCode: item.skuCode }) : null;
    const issuedQty = num(get(r, 'issuedQty'));
    await StoreOutward.findOneAndUpdate({ tenantId: tenant._id, outwardNo, lineNo }, {
      tenantId: tenant._id, outwardNo, outwardDate: d, lineNo, outwardType: clean(get(r, 'outwardType')) || 'OUTWARD', requisitionId: req?._id, requisitionNo,
      skuCode: item.skuCode, storeItemId: item._id, itemName: item.itemName, uom: item.uom,
      fromFoundry: clean(get(r, 'fromFoundry')) || 'STORE', fromDepartment: clean(get(r, 'fromDepartment')) || 'STORE',
      toFoundry: foundryVal(get(r, 'toFoundry', 'foundry')), toDepartment: clean(get(r, 'toDepartment', 'department')), issuedQty,
      rate: num(get(r, 'rate'), item.rate || 0), totalValue: issuedQty * num(get(r, 'rate'), item.rate || 0), issuedBy: issuer._id, issuedByName: issuer.name, receivedBy: clean(get(r, 'receivedBy')), remarks: clean(get(r, 'remarks')), isDeleted: false,
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const stock = item.stocks.find((s) => s.foundry === foundryVal(get(r, 'toFoundry', 'foundry')) && s.department === clean(get(r, 'toDepartment', 'department')));
    if (stock) stock.currentQty = Math.max(0, num(stock.currentQty) - issuedQty);
    item.recalcTotal();
    await item.save();
    if (req) { req.issuedQty = num(req.issuedQty) + issuedQty; req.balanceQty = Math.max(0, num(req.requestedQty) - req.issuedQty); req.status = req.balanceQty <= 0 ? 'Issued' : 'Partially Issued'; await req.save(); }
    count++;
  }
  return count;
}

async function importIndents(tenant, data) {
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  const holidays = await fetchHolidayDates(tenant._id);
  for (const r of data) {
    const item = await findItem(tenant._id, get(r, 'skuCode'));
    if (!item) continue;
    const user = await findUser(tenant._id, get(r, 'requestedByEmail')) || admin;
    const d = dateVal(get(r, 'indentDate'), new Date());
    const seqInfo = clean(get(r, 'indentNo')) ? null : await nextNumber(tenant._id, bool(get(r, 'isHo')) ? 'INDENT_HO' : 'INDENT', d, `${TENANT_CODE}/IND`);
    const indentNo = clean(get(r, 'indentNo')) || seqInfo.no;
    const lineNo = num(get(r, 'lineNo'), 1);
    const stock = item.stocks.find((s) => s.foundry === foundryVal(get(r, 'foundry')) && s.department === clean(get(r, 'department')));
    const workflowStages = await buildFmsStages(tenant._id, 'indent', d, holidays);
    await Indent.findOneAndUpdate({ tenantId: tenant._id, indentNo, lineNo }, { tenantId: tenant._id, prefix: `${TENANT_CODE}/IND/${getFiscalYear(d)}`, seqNo: seqInfo?.seq || num(get(r, 'seqNo'), lineNo), indentNo, isHO: bool(get(r, 'isHo')), lineNo, indentDate: d, requestedBy: user._id, requestorName: user.name, skuCode: item.skuCode, storeItemId: item._id, foundry: foundryVal(get(r, 'foundry')), department: clean(get(r, 'department')), itemName: item.itemName, uom: item.uom, requiredQty: num(get(r, 'requiredQty')), stockPosition: num(get(r, 'stockPosition'), stock?.currentQty || 0), uploadedIndentCopyUrl: clean(get(r, 'uploadedIndentCopyUrl')), workflowStages, status: statusVal(get(r, 'status'), 'Submitted'), remarks: clean(get(r, 'remarks')), isDeleted: false }, { upsert: true, new: true, setDefaultsOnInsert: true });
    count++;
  }
  return count;
}

function calcLine(qty, rate, discPercent, cgstRate, sgstRate) {
  const grossValue = qty * rate;
  const discountAmount = grossValue * (discPercent / 100);
  const taxableValue = grossValue - discountAmount;
  const cgstAmount = taxableValue * (cgstRate / 100);
  const sgstAmount = taxableValue * (sgstRate / 100);
  return { grossValue, discountAmount, taxableValue, cgstAmount, sgstAmount, totalValue: taxableValue + cgstAmount + sgstAmount };
}

async function importPurchaseOrders(tenant, data) {
  const grouped = new Map();
  for (const r of data) {
    const vendorKey = clean(get(r, 'vendorCode')) || clean(get(r, 'vendorName'));
    const d = dateVal(get(r, 'poDate'), new Date());
    const key = clean(get(r, 'poNo')) || `AUTO|${vendorKey}|${d.toISOString().slice(0, 10)}`;
    if (!grouped.has(key)) grouped.set(key, { rows: [], date: d });
    grouped.get(key).rows.push(r);
  }
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  const holidays = await fetchHolidayDates(tenant._id);
  for (const [key, g] of grouped) {
    const first = g.rows[0];
    const vendor = await findVendor(tenant._id, clean(get(first, 'vendorCode')) || clean(get(first, 'vendorName')));
    if (!vendor) continue;
    const user = await findUser(tenant._id, get(first, 'createdByEmail')) || admin;
    const poDate = dateVal(get(first, 'poDate'), new Date());
    const seqInfo = key.startsWith('AUTO|') ? await nextNumber(tenant._id, 'PO', poDate, 'POR') : null;
    const poNo = clean(get(first, 'poNo')) || seqInfo.no;
    const qsfSeq = await StoreSequence.nextSeq(tenant._id, 'QSF_PUR', getFiscalYear(poDate), `QSF/PUR/${getFiscalYear(poDate)}`);
    const qsfNo = clean(get(first, 'qsfNo')) || `QSF/PUR/${getFiscalYear(poDate)}/${String(qsfSeq).padStart(2, '0')}`;
    const cgstRate = num(get(first, 'cgstRate'));
    const sgstRate = num(get(first, 'sgstRate'));
    const subPOs = [];
    for (let i = 0; i < g.rows.length; i++) {
      const r = g.rows[i];
      const item = await findItem(tenant._id, get(r, 'skuCode'));
      if (!item) continue;
      const qty = num(get(r, 'orderedQty'));
      const rate = num(get(r, 'rate'), item.rate || 0);
      const discPercent = num(get(r, 'discPercent', 'disc'));
      const c = calcLine(qty, rate, discPercent, cgstRate, sgstRate);
      const indentNo = clean(get(r, 'indentNo'));
      const indent = indentNo ? await Indent.findOne({ tenantId: tenant._id, indentNo, skuCode: item.skuCode }) : null;
      subPOs.push({ subPoNo: `${poNo}/${i + 1}`, subPoSeq: i + 1, indentId: indent?._id, indentNo, vendorLineId: vendor._id, vendorLineName: vendor.name, skuCode: item.skuCode, hsnCode: item.hsnCode, storeItemId: item._id, foundry: foundryVal(get(r, 'foundry')), department: clean(get(r, 'department')), itemName: item.itemName, uom: item.uom, orderedQty: qty, receivedQty: num(get(r, 'receivedQty')), balanceQty: Math.max(0, qty - num(get(r, 'receivedQty'))), rate, discPercent, ...c, subtotalValue: c.taxableValue, discountTotal: c.discountAmount, cgstTotal: c.cgstAmount, sgstTotal: c.sgstAmount, leadTimeDays: num(get(r, 'leadTimeDays'), vendor.avgLeadTimeDays || 7), expectedDelivery: dateVal(get(r, 'expectedDelivery'), undefined), status: statusVal(get(r, 'lineStatus'), num(get(r, 'receivedQty')) >= qty ? 'Fully Received' : 'Open') });
      if (indent) { indent.status = 'PO Created'; indent.purchaseOrderId = undefined; indent.poNo = poNo; await indent.save(); }
    }
    const workflowStages = await buildFmsStages(tenant._id, 'po', poDate, holidays, { earliestDelivery: subPOs.map((s) => s.expectedDelivery).filter(Boolean).sort()[0] });
    const totals = subPOs.reduce((a, s) => ({ totalValue: a.totalValue + s.totalValue, subtotalValue: a.subtotalValue + s.taxableValue, discountTotal: a.discountTotal + s.discountAmount, cgstTotal: a.cgstTotal + s.cgstAmount, sgstTotal: a.sgstTotal + s.sgstAmount }), { totalValue: 0, subtotalValue: 0, discountTotal: 0, cgstTotal: 0, sgstTotal: 0 });
    await PurchaseOrder.findOneAndUpdate({ tenantId: tenant._id, poNo }, { tenantId: tenant._id, prefix: `POR/${getFiscalYear(poDate)}`, poSeqNo: seqInfo?.seq || num(get(first, 'poSeqNo'), 1), poNo, qsfNo, poDate, vendorId: vendor._id, vendorName: vendor.name, vendorContact: vendor.contactPerson, vendorKindAttention: vendor.kindAttention, vendorPhone: vendor.phone, vendorGstin: vendor.gstNo, vendorAddressText: [vendor.address?.line1, vendor.address?.line2, vendor.address?.city, vendor.address?.state, vendor.address?.pincode].filter(Boolean).join(', '), vendorEmail: vendor.email, vendorWhatsapp: vendor.whatsapp, poType: clean(get(first, 'poType')) || 'CGST_SGST', cgstRate, sgstRate, payTerms: clean(get(first, 'payTerms')) || vendor.paymentTerms || '.', deliveryTerms: clean(get(first, 'deliveryTerms')), shippingMode: clean(get(first, 'shippingMode')) || 'ROADWAYS', paymentMethod: clean(get(first, 'paymentMethod')) || 'NEFT/CHEQUE', deliveryLocation: clean(get(first, 'deliveryLocation')) || 'KOLKATA', createdBy: user._id, createdByName: user.name, workflowStages, subPOs, totalItems: subPOs.length, ...totals, status: statusVal(get(first, 'status'), 'Issued'), remarks: clean(get(first, 'remarks')), isDeleted: false }, { upsert: true, new: true, setDefaultsOnInsert: true });
    count += subPOs.length;
  }
  return count;
}

async function importGoodsReceipts(tenant, data) {
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  const holidays = await fetchHolidayDates(tenant._id);
  for (const r of data) {
    const po = await PurchaseOrder.findOne({ tenantId: tenant._id, poNo: clean(get(r, 'poNo')) });
    const item = await findItem(tenant._id, get(r, 'skuCode'));
    if (!po || !item) continue;
    const sub = clean(get(r, 'subPoNo')) ? po.subPOs.find((s) => s.subPoNo === clean(get(r, 'subPoNo'))) : po.subPOs.find((s) => s.skuCode === item.skuCode);
    const user = await findUser(tenant._id, get(r, 'receivedByEmail')) || admin;
    const actualReceiptDate = dateVal(get(r, 'actualReceiptDate'), new Date());
    const physicalReceivedQty = num(get(r, 'physicalReceivedQty'), num(get(r, 'receivedQty')));
    const invoiceBillQty = num(get(r, 'invoiceBillQty'), physicalReceivedQty);
    const shortExcessQty = physicalReceivedQty - invoiceBillQty;
    const noteType = shortExcessQty < 0 ? 'Debit Note' : shortExcessQty > 0 ? 'Credit Note' : 'None';
    const workflowStages = await buildFmsStages(tenant._id, 'grn', actualReceiptDate, holidays);
    const grn = await GoodsReceipt.create({ tenantId: tenant._id, purchaseOrderId: po._id, poNo: po.poNo, subPOId: sub?._id, subPoNo: sub?.subPoNo, vendorId: po.vendorId, vendorName: po.vendorName, skuCode: item.skuCode, storeItemId: item._id, foundry: foundryVal(get(r, 'foundry')) || sub?.foundry, department: clean(get(r, 'department')) || sub?.department, itemDescription: item.itemName, uom: item.uom, secondaryUom: clean(get(r, 'secondaryUom')), secondaryQtyReceived: num(get(r, 'secondaryQtyReceived')), orderedQty: sub?.orderedQty || num(get(r, 'orderedQty')), receivedQty: physicalReceivedQty, invoiceBillQty, physicalReceivedQty, shortExcessQty, noteType, noteQty: Math.abs(shortExcessQty), noteValue: Math.abs(shortExcessQty) * num(get(r, 'rate'), sub?.rate || item.rate || 0), balanceQty: Math.max(0, (sub?.orderedQty || 0) - ((sub?.receivedQty || 0) + physicalReceivedQty)), expectedDeliveryDate: sub?.expectedDelivery, actualReceiptDate, workflowStages, invoiceNo: clean(get(r, 'invoiceNo')), challanNo: clean(get(r, 'challanNo')), invoiceDate: dateVal(get(r, 'invoiceDate')), rate: num(get(r, 'rate'), sub?.rate || item.rate || 0), totalValue: physicalReceivedQty * num(get(r, 'rate'), sub?.rate || item.rate || 0), receivedBy: user._id, receivedByName: user.name, status: statusVal(get(r, 'status'), bool(get(r, 'stockAdded')) ? 'Stocked' : 'Pending QC'), isDeleted: false });
    if (sub) { sub.receivedQty = num(sub.receivedQty) + physicalReceivedQty; sub.balanceQty = Math.max(0, num(sub.orderedQty) - sub.receivedQty); sub.status = sub.balanceQty <= 0 ? 'Fully Received' : 'Partially Received'; }
    po.status = po.subPOs.every((s) => num(s.balanceQty) <= 0) ? 'Fully Received' : 'Partially Received';
    await po.save();
    if (bool(get(r, 'stockAdded'))) {
      const st = item.stocks.find((s) => s.foundry === grn.foundry && s.department === grn.department);
      if (st) st.currentQty = num(st.currentQty) + physicalReceivedQty;
      item.recalcTotal();
      await item.save();
    }
    count++;
  }
  return count;
}


const parseMonthKey = (v) => {
  const s = clean(v);
  if (!s) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  if (/^\d{4}-\d{1,2}$/.test(s)) { const [y,m]=s.split('-').map(Number); return { year:y, month:m }; }
  const d = dateVal(s);
  return { year: d ? d.getFullYear() : new Date().getFullYear(), month: d ? d.getMonth() + 1 : new Date().getMonth() + 1 };
};

async function importFloorBalances(tenant, data) {
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  for (const r of data) {
    const skuCode = clean(get(r, 'skuCode')).toUpperCase();
    if (!skuCode) continue;
    const item = await findItem(tenant._id, skuCode);
    const { year, month } = parseMonthKey(get(r, 'month'));
    await FloorMaterialBalance.findOneAndUpdate(
      { tenantId: tenant._id, year, month, foundry: foundryVal(get(r, 'foundry')), department: clean(get(r, 'department')), skuCode },
      { tenantId: tenant._id, year, month, costingType: clean(get(r, 'costingType')) || 'GREEN_SAND', foundry: foundryVal(get(r, 'foundry')), department: clean(get(r, 'department')), skuCode, itemName: item?.itemName || clean(get(r, 'itemName')), itemType: item?.itemType || clean(get(r, 'itemType')), motherItem: item?.motherItem || clean(get(r, 'motherItem')), uom: item?.uom || clean(get(r, 'uom')), outwardQty: num(get(r, 'storeOutwardQty')), floorLeftQty: num(get(r, 'floorLeftQty')), countedBy: admin?._id, countedByName: admin?.name || 'Admin', countedAt: new Date(), remarks: clean(get(r, 'remarks')), isDeleted: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count++;
  }
  return count;
}

const calcCostTotals = (run) => {
  const good = Number(run.goodCastingWtMt || 0);
  const all = [...(run.lines || []), ...(run.manualLines || [])];
  const production = all.reduce((s,l)=>s+num(l.totalAmount),0);
  const sales = production + (run.salesLines || []).reduce((s,l)=>s+num(l.totalAmount),0);
  const material = all.filter((l)=>['RAW MATERIAL','FERRO ALLOYES','TESTING','REFRACTORY','MOULDING','FETTLING, FINISHING','STORES CONSUMABLES'].includes(l.section)).reduce((s,l)=>s+num(l.totalAmount),0);
  const power = all.filter((l)=>String(l.section||'').toUpperCase().includes('POWER')).reduce((s,l)=>s+num(l.totalAmount),0);
  run.costOfProduction = production; run.costOfSales = sales;
  run.materialCostPerKg = good ? material / (good * 1000) : 0;
  run.powerCostPerKg = good ? power / (good * 1000) : 0;
  run.conversionCostPerKg = good ? (production - material - power) / (good * 1000) : 0;
  run.totalInputCostPerTon = good ? production / good : 0;
  run.totalInputCostPerKg = good ? production / (good * 1000) : 0;
  for (const l of [...all, ...(run.salesLines || [])]) { l.costPerTon = good ? num(l.totalAmount) / good : 0; l.costPerKg = good ? num(l.totalAmount) / (good * 1000) : 0; }
  return run;
};

async function importCostingRuns(tenant, metricRows, manualRows, salesRows) {
  let count = 0;
  const admin = await User.findOne({ tenantId: tenant._id, role: 'super_admin' });
  for (const r of metricRows) {
    const { year, month } = parseMonthKey(get(r, 'month'));
    const costingType = clean(get(r, 'costingType')) || 'GREEN_SAND';
    const foundry = foundryVal(get(r, 'foundry'));
    const department = clean(get(r, 'department'));
    const goodCastingWtMt = num(get(r, 'goodCastingWt', 'goodCastingWtMt'));
    if (!goodCastingWtMt) continue;
    const match = (x) => {
      const xm = parseMonthKey(get(x, 'month'));
      return xm.year === year && xm.month === month && (clean(get(x, 'costingType')) || 'GREEN_SAND') === costingType && foundryVal(get(x, 'foundry')) === foundry && clean(get(x, 'department')) === department;
    };
    const manualLines = manualRows.filter(match).map((m)=>({ section: clean(get(m, 'section')) || 'OTHERS', source: clean(get(m, 'source')) || 'MANUAL', itemName: clean(get(m, 'itemCostHead','itemName')) || 'Manual Cost', uom: clean(get(m, 'uom')) || 'RS', consumedQty: num(get(m, 'qty','consumedQty'),1), rate: num(get(m, 'rate')), totalAmount: num(get(m, 'totalAmount'), num(get(m, 'qty','consumedQty'),1) * num(get(m, 'rate'))), notes: clean(get(m, 'notes')) }));
    const salesLines = salesRows.filter(match).map((m)=>({ section: clean(get(m, 'section')) || 'COST OF SALES', source: 'MANUAL', itemName: clean(get(m, 'itemSalesCost','itemName')) || 'Sales Cost', uom: clean(get(m, 'uom')) || 'RS', consumedQty: num(get(m, 'qty','consumedQty'),1), rate: num(get(m, 'rate')), totalAmount: num(get(m, 'totalAmount'), num(get(m, 'qty','consumedQty'),1) * num(get(m, 'rate'))), notes: clean(get(m, 'notes')) }));
    const payload = calcCostTotals({ tenantId: tenant._id, costingNo: `${costingType}/${year}/${String(month).padStart(2,'0')}`, year, month, costingType, foundry, department, totalWorkingDays: num(get(r,'totalWorkingDays')), totalHeats: num(get(r,'totalHeats')), averageHeat: num(get(r,'totalWorkingDays')) ? num(get(r,'totalHeats'))/num(get(r,'totalWorkingDays')) : 0, liquidMetalMt: num(get(r,'liquidMetal','liquidMetalMt')), productionWtMt: num(get(r,'productionWt','productionWtMt')), rejectionWtMt: num(get(r,'rejectionWt','rejectionWtMt')), goodCastingWtMt, noBakeProductionMt: num(get(r,'noBakeProduction','noBakeProductionMt')), totalProductionMt: goodCastingWtMt + num(get(r,'noBakeProduction','noBakeProductionMt')), yieldPercent: num(get(r,'liquidMetal','liquidMetalMt')) ? goodCastingWtMt/num(get(r,'liquidMetal','liquidMetalMt'))*100 : 0, rejectionPercent: num(get(r,'productionWt','productionWtMt')) ? num(get(r,'rejectionWt','rejectionWtMt'))/num(get(r,'productionWt','productionWtMt'))*100 : 0, preparedBy: admin?._id, preparedByName: admin?.name || 'Admin', lines: [], manualLines, salesLines, remarks: clean(get(r,'remarks')), isDeleted: false });
    await CostingRun.findOneAndUpdate({ tenantId: tenant._id, costingType, year, month }, payload, { upsert: true, new: true, setDefaultsOnInsert: true });
    count++;
  }
  return count;
}

async function importHolidays(tenant, data) {
  const grouped = new Map();
  data.forEach((r) => {
    const year = num(get(r, 'year'), new Date().getFullYear());
    const code = clean(get(r, 'calendarCode')) || `FACTORY_${year}`;
    const key = `${year}|${code}`;
    if (!grouped.has(key)) grouped.set(key, { year, code, holidays: [] });
    const d = dateVal(get(r, 'holidayDate'));
    const name = clean(get(r, 'holidayName'));
    if (d && name) grouped.get(key).holidays.push({ date: d, name, type: clean(get(r, 'type')) || 'company', isPaid: bool(get(r, 'isPaid'), true), isHalfDay: bool(get(r, 'isHalfDay')) });
  });
  let count = 0;
  for (const g of grouped.values()) {
    await HolidayCalendar.findOneAndUpdate({ tenantId: tenant._id, code: g.code, year: g.year }, { tenantId: tenant._id, code: g.code, name: `Factory Holidays ${g.year}`, year: g.year, holidays: g.holidays, isActive: true, isDeleted: false }, { upsert: true, new: true });
    count += g.holidays.length;
  }
  return count;
}


async function importWorkbookForTenant(tenant, wb, options = {}) {
  const summary = {};
  const sections = new Set(options.sections || []);
  const wants = (name) => !sections.size || sections.has(name);
  if (wants('FoundriesDepartments')) summary.foundriesDepartments = await importFoundries(tenant, rows(wb, 'FoundriesDepartments'));
  if (wants('Users')) summary.users = await importUsers(tenant, rows(wb, 'Users'));
  if (wants('Vendors')) summary.vendors = await importVendors(tenant, rows(wb, 'Vendors'));
  if (wants('Items')) summary.items = await importItems(tenant, rows(wb, 'Items'));
  if (wants('FmsTemplates')) summary.fmsSteps = await importFmsTemplates(tenant, rows(wb, 'FmsTemplates'));
  if (wants('Holidays')) summary.holidays = await importHolidays(tenant, rows(wb, 'Holidays'));
  if (wants('Budgets')) summary.budgetLines = await importBudgets(tenant, rows(wb, 'Budgets'));
  if (wants('Requisitions')) summary.requisitions = await importRequisitions(tenant, rows(wb, 'Requisitions'));
  if (wants('Outwards')) summary.outwards = await importOutwards(tenant, rows(wb, 'Outwards'));
  if (wants('Indents')) summary.indents = await importIndents(tenant, rows(wb, 'Indents'));
  if (wants('PurchaseOrders')) summary.purchaseOrderLines = await importPurchaseOrders(tenant, rows(wb, 'PurchaseOrders'));
  if (wants('GoodsReceipts')) summary.goodsReceipts = await importGoodsReceipts(tenant, rows(wb, 'GoodsReceipts'));
  if (wants('Floor Material Left')) summary.floorBalances = await importFloorBalances(tenant, rows(wb, 'Floor Material Left'));
  if (wants('Costing')) summary.costingRuns = await importCostingRuns(tenant, rows(wb, 'Production Metrics'), rows(wb, 'Manual Cost Rows'), rows(wb, 'Cost of Sales Rows'));
  await syncAllOpenTasks(tenant._id);
  return summary;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run import:excel -- /path/to/JPK_Store_Bulk_Import_Template.xlsx');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`✓ Connected to ${DB_NAME}`);
  const tenant = await ensureTenant();
  await ensureAdmin(tenant);
  const wb = XLSX.readFile(path.resolve(filePath), { cellDates: true });
  const summary = await importWorkbookForTenant(tenant, wb);
  console.log('\nImport summary');
  Object.entries(summary).forEach(([k, v]) => console.log(`✓ ${k}: ${v}`));
  console.log('\nDone. Run npm run migrate:ims after large imports to refresh planned dates/tasks if needed.');
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error('✗ Excel import failed:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  });
}

module.exports = { importWorkbookForTenant, rows };
