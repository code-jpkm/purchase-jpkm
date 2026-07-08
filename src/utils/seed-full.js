require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Tenant = require('../models/Tenant.schema');
const User = require('../models/User.schema');
const Foundry = require('../models/Foundry-dept.schema');
const Vendor = require('../models/Vendor.schema');
const StoreItem = require('../models/Store-item.schema');
const HolidayCalendar = require('../models/Holiday-calendar.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const Uom = require('../models/Uom.schema');
const MotherItem = require('../models/Mother-item.schema');
const { ensureFmsTemplates, syncAllOpenTasks } = require('../services/fms.service');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'jpk_store';
const TENANT_CODE = (process.env.SEED_TENANT_CODE || 'JPKM').trim().toUpperCase();
const SEED_SAMPLE_DATA = process.env.SEED_SAMPLE_DATA !== 'false';

const ALL_PERMISSIONS = [
  '*', 'store:read', 'store:write', 'store:admin', 'inventory:read', 'inventory:write',
  'indent:read', 'indent:write', 'purchase:read', 'purchase:write', 'purchase:admin',
  'po:read', 'po:write', 'grn:read', 'grn:write', 'outward:read', 'outward:write',
  'requisition:read', 'requisition:write', 'budget:read', 'budget:write', 'budget:approve',
  'stock_statement:read', 'stock_statement:write', 'vendor:read', 'vendor:write', 'vendor:admin',
  'foundry:read', 'foundry:write', 'holiday:read', 'holiday:write', 'fms:read', 'fms:admin',
  'user:read', 'user:write', 'help:read', 'help:write', 'ai:use', 'costing:read', 'costing:write', 'reports:read'
];

const FOUNDRIES = [
  { name: 'D. I', fullName: 'Ductile Iron', code: 'DI', departments: ['MAINTENANCE', 'CASTING (NO BAKE)', 'PATTERN (GREEN SAND)', 'MELTING (NO BAKE)', 'CASTING (GREEN SAND)', 'MELTING (GREEN SAND)', 'WAREHOUSE (GREEN SAND)', 'LABORATORY', 'FETLING (GREEN SAND)'] },
  { name: 'C. I', fullName: 'Cast Iron', code: 'CI', departments: ['CASTING (GREEN SAND)', 'PATTERN (GREEN SAND)', 'MELTING (GREEN SAND)', 'FETLING (GREEN SAND)', 'MAINTENANCE'] },
];

const USERS = [
  { name: 'Admin', email: process.env.SEED_EMAIL || 'admin@jpkmetals.com', password: process.env.SEED_PASSWORD || 'Admin@123', role: 'super_admin', permissions: ALL_PERMISSIONS },
  { name: 'Arun Sahoo', email: 'arun.store@jpkm.in', password: 'User@123', role: 'store_manager', permissions: ['store:read','store:write','inventory:read','inventory:write','indent:read','indent:write','grn:read','grn:write','outward:read','outward:write','requisition:read','requisition:write','fms:read'] },
  { name: 'Soumen Shee', email: 'soumen.purchase@jpkm.in', password: 'User@123', role: 'purchase_manager', permissions: ['purchase:read','purchase:write','po:read','po:write','vendor:read','indent:read','budget:read','fms:read'] },
  { name: 'Swagata Bawali', email: 'swagata.accounts@jpkm.in', password: 'User@123', role: 'accounts', permissions: ['grn:read','stock_statement:read','budget:read','fms:read'] },
];


const UOMS = ['PCS','KGS','LTR','MTR','NOS','SET','PAIR','BOX','ROLL','BAG','TON','SQFT'];
const MOTHER_ITEMS = ['O-RING','FCF FILTER','RESIN','BUCKET','CHISEL','BROAD NAIL','PAINT','HARD COKE','LIME STONE','PACKING MATERIAL'];

const VENDORS = [
  { vendorCode: 'VEN-001', name: 'REVALTRA ENERGIES', kindAttention: 'Sales Team', contactPerson: 'Sales Team', email: 'sales@revaltra.example', phone: '7047437018', whatsapp: '917047437018', gstNo: '19ABCDE1234F1Z5', address: { line1: 'Industrial Area', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' }, paymentTerms: '30 days', avgLeadTimeDays: 2, rating: 4, categories: ['LPG', 'ENERGY'] },
  { vendorCode: 'VEN-002', name: 'PREMIER TOOLS TRADING CO', kindAttention: 'Sales Team', contactPerson: 'Sales Team', email: 'sales@premiertools.example', phone: '7047437018', whatsapp: '917047437018', gstNo: '19XYZDE1234F1Z5', address: { line1: 'Bentinck Street', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' }, paymentTerms: '15 days', avgLeadTimeDays: 1, rating: 4, categories: ['TOOLS', 'DRILL', 'BUCKET'] },
];

const ITEMS = [
  { code: 1, skuCode: 'JPK/STOR/001', itemName: '10100815 O-Ring D55-3.00', itemType: 'Stores', motherItem: 'O-Ring', uom: 'PCS', rate: 10, stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionLow: 1, dailyAvgConsumptionNormal: 1, dailyAvgConsumptionPeak: 2, leadTime: 4, safetyFactor: 1, maxLevel: 4, openingStockQty: 4, currentQty: 4 }] },
  { code: 2, skuCode: 'JPK/STOR/002', itemName: 'FCF-2 200 x 200 x 40 10PPI Filter', itemType: 'Stores', motherItem: 'FCF FILTER', uom: 'PCS', rate: 180, stocks: [{ foundry: 'D. I', department: 'CASTING (NO BAKE)', dailyAvgConsumptionLow: 6, dailyAvgConsumptionNormal: 8, dailyAvgConsumptionPeak: 12, leadTime: 6, safetyFactor: 1, maxLevel: 48, openingStockQty: 40, currentQty: 148 }] },
  { code: 7, skuCode: 'JPK/STOR/007', itemName: 'Arkofluid 5848', itemType: 'Chemical', motherItem: 'RESIN', hsnCode: '3816', uom: 'KGS', rate: 90, stocks: [{ foundry: 'D. I', department: 'CASTING (NO BAKE)', dailyAvgConsumptionLow: 40, dailyAvgConsumptionNormal: 60, dailyAvgConsumptionPeak: 80, leadTime: 12, safetyFactor: 1.5, maxLevel: 1080, openingStockQty: 1994, currentQty: 238 }] },
  { code: 11, skuCode: 'JPK/STOR/011', itemName: 'Bucket 08"', itemType: 'Stores', motherItem: 'BUCKET', uom: 'PCS', rate: 168, stocks: [{ foundry: 'D. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionLow: 1, dailyAvgConsumptionNormal: 1, dailyAvgConsumptionPeak: 2, leadTime: 6, safetyFactor: 1, maxLevel: 6, openingStockQty: 0, currentQty: 0 }, { foundry: 'C. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionLow: 1, dailyAvgConsumptionNormal: 2, dailyAvgConsumptionPeak: 3, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 12, currentQty: 19 }] },
  { code: 12, skuCode: 'JPK/STOR/012', itemName: 'Bucket 10"', itemType: 'Stores', motherItem: 'BUCKET', uom: 'PCS', rate: 185, stocks: [{ foundry: 'D. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 0, currentQty: 0 }, { foundry: 'C. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 0, currentQty: 2 }, { foundry: 'D. I', department: 'MELTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 3, currentQty: 1 }] },
  { code: 13, skuCode: 'JPK/STOR/013', itemName: 'Bucket 12"', itemType: 'Stores', motherItem: 'BUCKET', uom: 'PCS', rate: 200, stocks: [{ foundry: 'D. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 0, currentQty: 6 }, { foundry: 'C. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 5, safetyFactor: 1, maxLevel: 10, openingStockQty: 4, currentQty: 5 }] },
  { code: 14, skuCode: 'JPK/STOR/014', itemName: 'Chisel', itemType: 'Stores', motherItem: 'CHISEL', uom: 'PCS', rate: 100, stocks: [{ foundry: 'C. I', department: 'PATTERN (GREEN SAND)', dailyAvgConsumptionNormal: 1, leadTime: 2, safetyFactor: 1, maxLevel: 2, openingStockQty: 0, currentQty: 0 }, { foundry: 'D. I', department: 'PATTERN (GREEN SAND)', dailyAvgConsumptionNormal: 1, leadTime: 2, safetyFactor: 1, maxLevel: 2, openingStockQty: 2, currentQty: 2 }] },
];

function prepareStocks(stocks, motherItem) {
  return stocks.map((s) => ({ currentSeason: 'Normal', outwardFormType: 'OUTWARD FORM', interDeptTransferFormType: 'INTER DEPARTMENT TRANSFER FORM', interDeptTransferQty: 0, qtyInDepartment: 0, motherItem, sendToMonthlyStock: true, ...s }));
}

async function main() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`✓ Connected to ${DB_NAME}`);

  let tenant = await Tenant.findOne({ code: TENANT_CODE });
  if (!tenant) tenant = new Tenant({ code: TENANT_CODE });
  tenant.name = process.env.SEED_TENANT_NAME || 'JPK Metals';
  tenant.status = 'active';
  tenant.countryCode = 'IN';
  tenant.timezone = 'Asia/Kolkata';
  tenant.fiscalYearStart = '04-01';
  tenant.isDeleted = false;
  tenant.deletedAt = undefined;
  await tenant.save();
  console.log(`✓ Tenant ready: ${tenant.code}`);

  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await User.findOneAndUpdate({ tenantId: tenant._id, email: user.email.toLowerCase() }, { tenantId: tenant._id, name: user.name, email: user.email.toLowerCase(), passwordHash, role: user.role, permissions: user.permissions, isActive: true, isDeleted: false }, { upsert: true, new: true });
  }
  console.log(`✓ Users ready: ${USERS.length}`);

  for (const f of FOUNDRIES) {
    await Foundry.findOneAndUpdate({ tenantId: tenant._id, code: f.code }, { tenantId: tenant._id, name: f.name, fullName: f.fullName, code: f.code, departments: f.departments.map((name) => ({ name, code: name.replace(/[^A-Z0-9]/g, '').slice(0, 12), isActive: true })), isActive: true, isDeleted: false }, { upsert: true, new: true });
  }
  console.log(`✓ Foundries/departments ready`);

  for (const code of UOMS) await Uom.findOneAndUpdate({ tenantId: tenant._id, code }, { tenantId: tenant._id, code, name: code, isActive: true, isDeleted: false }, { upsert: true, new: true });
  for (const name of MOTHER_ITEMS) await MotherItem.findOneAndUpdate({ tenantId: tenant._id, name }, { tenantId: tenant._id, name, itemType: name === 'RESIN' ? 'Chemical' : 'Stores', isActive: true, isDeleted: false }, { upsert: true, new: true });
  console.log(`✓ UOM and Mother Item masters ready`);

  for (const v of VENDORS) await Vendor.findOneAndUpdate({ tenantId: tenant._id, vendorCode: v.vendorCode }, { tenantId: tenant._id, ...v, isActive: true, isDeleted: false }, { upsert: true, new: true });
  console.log(`✓ Vendors ready: ${VENDORS.length}`);

  if (SEED_SAMPLE_DATA) {
    for (const item of ITEMS) {
      const stocks = prepareStocks(item.stocks, item.motherItem);
      const totalAvailableQty = stocks.reduce((sum, s) => sum + Number(s.currentQty || 0), 0);
      await StoreItem.findOneAndUpdate({ tenantId: tenant._id, skuCode: item.skuCode }, { tenantId: tenant._id, ...item, stocks, totalAvailableQty, productCategory: item.itemType === 'Chemical' ? 'CHEMICAL' : 'STORE', preference: item.itemType === 'Chemical' ? 1 : 2, isActive: true, isDeleted: false }, { upsert: true, new: true });
    }
    console.log(`✓ Sample items ready: ${ITEMS.length}`);
  }

  const year = new Date().getFullYear();
  await HolidayCalendar.findOneAndUpdate({ tenantId: tenant._id, code: `FACTORY_${year}`, year }, { tenantId: tenant._id, name: `Factory Holidays ${year}`, code: `FACTORY_${year}`, year, isActive: true, isDeleted: false, $setOnInsert: { holidays: [] } }, { upsert: true, new: true });
  await ensureFmsTemplates(tenant._id);
  await syncAllOpenTasks(tenant._id);

  console.log('\nSeed complete');
  console.log(`Tenant Code : ${TENANT_CODE}`);
  console.log(`Admin Email : ${(process.env.SEED_EMAIL || 'admin@jpkmetals.com').toLowerCase()}`);
  console.log(`Admin Pass  : ${process.env.SEED_PASSWORD || 'Admin@123'}`);
  console.log('Sample users: arun.store@jpkm.in / soumen.purchase@jpkm.in / swagata.accounts@jpkm.in, password User@123');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('✗ Seed full failed:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
