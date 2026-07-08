require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Tenant = require('../models/Tenant.schema');
const User = require('../models/User.schema');
const Foundry = require('../models/Foundry-dept.schema');
const StoreItem = require('../models/Store-item.schema');
const Uom = require('../models/Uom.schema');
const MotherItem = require('../models/Mother-item.schema');
const Vendor = require('../models/Vendor.schema');
const HolidayCalendar = require('../models/Holiday-calendar.schema');
const { ensureFmsTemplates } = require('../services/fms.service');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'jpk_store';
const TENANT_CODE = (process.env.SEED_TENANT_CODE || 'JPKM').toUpperCase();

const ALL_PERMISSIONS = [
  '*',
  'store:read', 'store:write', 'store:admin',
  'inventory:read', 'inventory:write',
  'indent:read', 'indent:write',
  'purchase:read', 'purchase:write', 'purchase:admin',
  'po:read', 'po:write',
  'grn:read', 'grn:write',
  'outward:read', 'outward:write',
  'requisition:read', 'requisition:write',
  'budget:read', 'budget:write', 'budget:approve',
  'stock_statement:read', 'stock_statement:write',
  'vendor:read', 'vendor:write', 'vendor:admin',
  'foundry:read', 'foundry:write',
  'holiday:read', 'holiday:write',
  'fms:read', 'fms:admin',
  'user:read', 'user:write',
  'ai:use', 'costing:read', 'costing:write', 'reports:read',
];

const UOMS = ['PCS','KGS','LTR','LITRE','MTR','NOS','SET','PAIR','BOX','ROLL','BAG','TON','MT','CFT','PKT'];
const MOTHER_ITEMS = ['BUCKET','BEARING','RESIN','PIG IRON','SCRAP','BENTONITE','GRAPHITE POWDER','GRAFCOAT PAINT','GRINDING WHEEL','PACKING MATERIAL','CHISEL'];

const FOUNDRIES = [
  {
    name: 'D. I', fullName: 'Ductile Iron', code: 'DI',
    departments: [
      'MAINTENANCE',
      'CASTING (NO BAKE)',
      'PATTERN (GREEN SAND)',
      'MELTING (NO BAKE)',
      'CASTING (GREEN SAND)',
      'MELTING (GREEN SAND)',
      'WAREHOUSE (GREEN SAND)',
      'LABORATORY',
      'FETLING (GREEN SAND)',
    ].map((name) => ({ name, code: name.replace(/[^A-Z0-9]/g, '').slice(0, 10), isActive: true })),
  },
  {
    name: 'C. I', fullName: 'Cast Iron', code: 'CI',
    departments: [
      'CASTING (GREEN SAND)',
      'PATTERN (GREEN SAND)',
      'MELTING (GREEN SAND)',
      'FETLING (GREEN SAND)',
      'MAINTENANCE',
    ].map((name) => ({ name, code: name.replace(/[^A-Z0-9]/g, '').slice(0, 10), isActive: true })),
  },
];

const SAMPLE_VENDORS = [
  { vendorCode: 'VEN-001', name: 'REVALTRA ENERGIES', contactPerson: 'Sales Team', email: 'sales@revaltra.example', whatsapp: '919876543210', avgLeadTimeDays: 2, categories: ['LPG', 'ENERGY'] },
  { vendorCode: 'VEN-002', name: 'PREMIER TOOLS TRADING CO', contactPerson: 'Sales Team', email: 'sales@premiertools.example', whatsapp: '919876543211', avgLeadTimeDays: 1, categories: ['TOOLS', 'DRILL'] },
];

const SAMPLE_ITEMS = [
  { code: 1, skuCode: 'JPK/STOR/001', itemName: '10100815 O-Ring D55-3.00', uom: 'PCS', motherItem: 'MOULDING MACHINE SPARE', stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 1, leadTime: 4, safetyFactor: 1, maxLevel: 4, openingStockQty: 4, currentQty: 4 }] },
  { code: 2, skuCode: 'JPK/STOR/002', itemName: 'FCF-2  200 x 200 x 40 10PPI Filter', uom: 'PCS', motherItem: 'FCF FILTER', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'CASTING (NO BAKE)', dailyAvgConsumptionNormal: 8, leadTime: 6, safetyFactor: 1, maxLevel: 48, openingStockQty: 40, currentQty: 148 }] },
  { code: 3, skuCode: 'JPK/STOR/003', itemName: '3TF34 Air Break Power Contactor ,24V DC', uom: 'PCS', motherItem: 'ELECTRIC CONTACTOR', stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 1, leadTime: 4, safetyFactor: 1, maxLevel: 4, openingStockQty: 2, currentQty: 2 }] },
  { code: 4, skuCode: 'JPK/STOR/004', itemName: 'Air Tank Pen Hose RL-2", 600mm Long', uom: 'PCS', motherItem: 'MOULDING MACHINE SPARE', stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 1, leadTime: 2, safetyFactor: 1, maxLevel: 2, openingStockQty: 2, currentQty: 2 }] },
  { code: 5, skuCode: 'JPK/STOR/005', itemName: 'Aluminium Marking', uom: 'PCS', motherItem: 'Aluminium Marking', stocks: [{ foundry: 'D. I', department: 'PATTERN (GREEN SAND)', dailyAvgConsumptionNormal: 1, leadTime: 1, safetyFactor: 1, maxLevel: 1, openingStockQty: 1, currentQty: 1 }] },
  { code: 6, skuCode: 'JPK/STOR/006', itemName: 'Antimony ( SB )', uom: 'KGS', productCategory: 'CHEMICAL', preference: 1, motherItem: 'Antimony ( SB )', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'MELTING (NO BAKE)', dailyAvgConsumptionNormal: 0.5, leadTime: 12, safetyFactor: 1.5, maxLevel: 9, openingStockQty: 17.208, currentQty: 0 }] },
  { code: 7, skuCode: 'JPK/STOR/007', itemName: 'Arkofluid 5848', hsnCode: '3816', uom: 'KGS', productCategory: 'CHEMICAL', preference: 1, motherItem: 'RESIN', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'CASTING (NO BAKE)', dailyAvgConsumptionNormal: 60, leadTime: 12, safetyFactor: 1.5, maxLevel: 1080, openingStockQty: 1994, currentQty: 238 }] },
  { code: 8, skuCode: 'JPK/STOR/008', itemName: 'Armature 5"   P.NO - 901513', hsnCode: '8505', uom: 'PCS', motherItem: 'ARMATURE', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 1, leadTime: 6, safetyFactor: 1, maxLevel: 6, openingStockQty: 4, currentQty: 8 }] },
  { code: 9, skuCode: 'JPK/STOR/009', itemName: 'Armature 9"', hsnCode: '8467', uom: 'PCS', motherItem: 'ARMATURE', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 8, currentQty: 12 }] },
  { code: 10, skuCode: 'JPK/STOR/010', itemName: 'Auxiliary Contact Block for 3TF3/3TH3 Contactor', uom: 'PCS', motherItem: 'ELECTRIC CONTACTOR', stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 1, leadTime: 2, safetyFactor: 1, maxLevel: 2, openingStockQty: 1, currentQty: 1 }] },
  { code: 11, skuCode: 'JPK/STOR/011', itemName: 'Bucket 08"', uom: 'PCS', motherItem: 'BUCKET', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 1, leadTime: 6, safetyFactor: 1, maxLevel: 6, openingStockQty: 0, currentQty: 0 }, { foundry: 'C. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 12, currentQty: 19 }] },
  { code: 12, skuCode: 'JPK/STOR/012', itemName: 'Bucket 10"', uom: 'PCS', motherItem: 'BUCKET', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 0, currentQty: 0 }, { foundry: 'C. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 0, currentQty: 2 }, { foundry: 'D. I', department: 'MELTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 3, currentQty: 1 }] },
  { code: 13, skuCode: 'JPK/STOR/013', itemName: 'Bucket 12"', uom: 'PCS', motherItem: 'BUCKET', sendToMonthlyStock: true, stocks: [{ foundry: 'D. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 6, safetyFactor: 1, maxLevel: 12, openingStockQty: 0, currentQty: 6 }, { foundry: 'C. I', department: 'CASTING (GREEN SAND)', dailyAvgConsumptionNormal: 2, leadTime: 5, safetyFactor: 1, maxLevel: 10, openingStockQty: 4, currentQty: 5 }] },
  { code: 14, skuCode: 'JPK/STOR/014', itemName: 'Chisel', uom: 'PCS', motherItem: 'Chisel', stocks: [{ foundry: 'C. I', department: 'PATTERN (GREEN SAND)', dailyAvgConsumptionNormal: 1, leadTime: 2, safetyFactor: 1, maxLevel: 2, openingStockQty: 0, currentQty: 0 }, { foundry: 'D. I', department: 'PATTERN (GREEN SAND)', dailyAvgConsumptionNormal: 1, leadTime: 2, safetyFactor: 1, maxLevel: 2, openingStockQty: 2, currentQty: 2 }] },
  { code: 15, skuCode: 'JPK/STOR/015', itemName: 'Bearing 1208 - K', uom: 'PCS', motherItem: 'BEARING', stocks: [{ foundry: 'D. I', department: 'MAINTENANCE', dailyAvgConsumptionNormal: 1, leadTime: 5, safetyFactor: 1, maxLevel: 5, openingStockQty: 5, currentQty: 5 }] },
];

const prepareStocks = (stocks, item) => stocks.map((stock) => ({
  currentSeason: 'Normal',
  outwardFormType: 'OUTWARD FORM',
  interDeptTransferFormType: 'INTER DEPARTMENT TRANSFER FORM',
  interDeptTransferQty: 0,
  qtyInDepartment: 0,
  motherItem: item.motherItem,
  sendToMonthlyStock: !!item.sendToMonthlyStock,
  ...stock,
}));

async function seed() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`✓ Connected to MongoDB database: ${DB_NAME}`);

  let tenant = await Tenant.findOne({ $or: [{ code: TENANT_CODE }, { name: 'JPK Metals' }] });
  if (!tenant) tenant = new Tenant();
  tenant.name = 'JPK Metals';
  tenant.code = TENANT_CODE;
  tenant.status = 'active';
  tenant.isDeleted = false;
  tenant.deletedAt = undefined;
  tenant.countryCode = 'IN';
  tenant.timezone = 'Asia/Kolkata';
  tenant.fiscalYearStart = '04-01';
  await tenant.save();
  console.log('✓ Tenant ready:', tenant.name, '| Code:', tenant.code, '| ID:', tenant._id);

  const email = (process.env.SEED_EMAIL || 'admin@jpkmetals.com').toLowerCase();
  const password = process.env.SEED_PASSWORD || 'Admin@123';
  const resetPassword = process.env.SEED_RESET_PASSWORD !== 'false';
  let user = await User.findOne({ tenantId: tenant._id, email });
  const passwordHash = await bcrypt.hash(password, 12);
  if (!user) {
    user = await User.create({
      tenantId: tenant._id,
      name: 'Admin',
      email,
      passwordHash,
      role: 'super_admin',
      permissions: ALL_PERMISSIONS,
      isActive: true,
    });
    console.log('✓ Admin user created');
  } else {
    user.name = user.name || 'Admin';
    user.role = 'super_admin';
    user.permissions = ALL_PERMISSIONS;
    user.isActive = true;
    user.isDeleted = false;
    if (resetPassword || !user.passwordHash) user.passwordHash = passwordHash;
    await user.save();
    console.log(`✓ Admin user updated${resetPassword ? ' and password reset' : ''}`);
  }

  for (const f of FOUNDRIES) {
    await Foundry.findOneAndUpdate(
      { tenantId: tenant._id, code: f.code },
      { ...f, tenantId: tenant._id, isActive: true, isDeleted: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✓ Foundry ready: ${f.name} (${f.departments.length} depts)`);
  }

  for (const code of UOMS) {
    await Uom.findOneAndUpdate({ tenantId: tenant._id, code }, { tenantId: tenant._id, code, name: code, isActive: true, isDeleted: false }, { upsert: true, new: true });
  }
  for (const name of MOTHER_ITEMS) {
    await MotherItem.findOneAndUpdate({ tenantId: tenant._id, name }, { tenantId: tenant._id, name, itemType: name === 'RESIN' ? 'Chemical' : 'Stores', isActive: true, isDeleted: false }, { upsert: true, new: true });
  }
  console.log('✓ UOM master ready and Mother Item master ready');

  for (const vendor of SAMPLE_VENDORS) {
    await Vendor.findOneAndUpdate(
      { tenantId: tenant._id, vendorCode: vendor.vendorCode },
      { ...vendor, tenantId: tenant._id, isActive: true, isDeleted: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`✓ Vendors ready: ${SAMPLE_VENDORS.length}`);

  const currentYear = new Date().getFullYear();
  await HolidayCalendar.findOneAndUpdate(
    { tenantId: tenant._id, code: `FACTORY_${currentYear}`, year: currentYear },
    {
      $set: {
        tenantId: tenant._id,
        name: `Factory Holidays ${currentYear}`,
        code: `FACTORY_${currentYear}`,
        year: currentYear,
        isActive: true,
        isDeleted: false,
      },
      $setOnInsert: { holidays: [] },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✓ Holiday calendar ready: Factory Holidays ${currentYear}`);
  await ensureFmsTemplates(tenant._id);
  console.log('✓ FMS templates ready: Indent, PO, Goods Receipt');

  for (const rawItem of SAMPLE_ITEMS) {
    const stocks = prepareStocks(rawItem.stocks, rawItem);
    const totalAvailableQty = stocks.reduce((sum, stock) => sum + (Number(stock.currentQty) || 0), 0);
    await StoreItem.findOneAndUpdate(
      { tenantId: tenant._id, skuCode: rawItem.skuCode },
      {
        tenantId: tenant._id,
        code: rawItem.code,
        skuCode: rawItem.skuCode,
        itemName: rawItem.itemName,
        hsnCode: rawItem.hsnCode,
        gstPercent: rawItem.gstPercent || 0,
        uom: rawItem.uom,
        secondaryUom: rawItem.secondaryUom,
        secondaryUomFormula: rawItem.secondaryUomFormula,
        productCategory: rawItem.productCategory || 'STORE',
        preference: rawItem.preference || 2,
        rate: rawItem.rate || 0,
        salePrice: rawItem.salePrice || 0,
        profitPercent: rawItem.profitPercent || 0,
        lastVendorName: rawItem.lastVendorName,
        totalAvailableQty,
        stocks,
        isActive: true,
        isDeleted: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`✓ Store sample items ready: ${SAMPLE_ITEMS.length}`);

  console.log('\n──────────────────────────────────────');
  console.log('  Seed complete!');
  console.log('  Frontend : http://localhost:3000/login');
  console.log('  Tenant   :', TENANT_CODE);
  console.log('  Email    :', email);
  console.log('  Password :', password);
  console.log('──────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('\n✗ Seed failed:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
