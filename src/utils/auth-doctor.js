require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Tenant = require('../models/Tenant.schema');
const User = require('../models/User.schema');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'jpk_store';
const TENANT_CODE = (process.env.SEED_TENANT_CODE || 'JPKM').trim().toUpperCase();
const EMAIL = (process.env.SEED_EMAIL || 'admin@jpkmetals.com').trim().toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD || 'Admin@123';

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
  'ai:use', 'reports:read',
];

async function main() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`✓ Connected to database: ${DB_NAME}`);

  let tenant = await Tenant.findOne({ code: TENANT_CODE });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'JPK Metals',
      code: TENANT_CODE,
      status: 'active',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      fiscalYearStart: '04-01',
      isDeleted: false,
    });
    console.log('✓ Tenant created');
  } else {
    tenant.name = tenant.name || 'JPK Metals';
    tenant.code = TENANT_CODE;
    tenant.status = 'active';
    tenant.countryCode = tenant.countryCode || 'IN';
    tenant.timezone = tenant.timezone || 'Asia/Kolkata';
    tenant.fiscalYearStart = tenant.fiscalYearStart || '04-01';
    tenant.isDeleted = false;
    tenant.deletedAt = undefined;
    await tenant.save();
    console.log('✓ Tenant fixed');
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  let user = await User.findOne({ tenantId: tenant._id, email: EMAIL });
  if (!user) {
    user = await User.create({
      tenantId: tenant._id,
      name: 'Admin',
      email: EMAIL,
      passwordHash,
      role: 'super_admin',
      permissions: ALL_PERMISSIONS,
      isActive: true,
      isDeleted: false,
    });
    console.log('✓ Admin user created');
  } else {
    user.name = user.name || 'Admin';
    user.email = EMAIL;
    user.passwordHash = passwordHash;
    user.role = 'super_admin';
    user.permissions = ALL_PERMISSIONS;
    user.isActive = true;
    user.isDeleted = false;
    user.deletedAt = undefined;
    await user.save();
    console.log('✓ Admin user fixed and password reset');
  }

  const loginTenant = await Tenant.findOne({ code: TENANT_CODE, status: 'active', isDeleted: { $ne: true } });
  const loginUser = loginTenant
    ? await User.findOne({ tenantId: loginTenant._id, email: EMAIL, isDeleted: { $ne: true }, isActive: true }).populate('tenantId')
    : null;
  const passwordOk = loginUser ? await bcrypt.compare(PASSWORD, loginUser.passwordHash || '') : false;

  console.log('\nAuth check result');
  console.log('Tenant Code :', TENANT_CODE);
  console.log('Tenant ID   :', loginTenant?._id?.toString() || 'NOT FOUND');
  console.log('Email       :', EMAIL);
  console.log('User ID     :', loginUser?._id?.toString() || 'NOT FOUND');
  console.log('Password OK :', passwordOk ? 'YES' : 'NO');
  console.log('Login should work:', loginTenant && loginUser && passwordOk ? 'YES' : 'NO');

  await mongoose.disconnect();
  process.exit(loginTenant && loginUser && passwordOk ? 0 : 1);
}

main().catch(async (err) => {
  console.error('✗ Auth doctor failed:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
