require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant.schema');
const StoreItem = require('../models/Store-item.schema');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'jpk_store';
const TENANT_CODE = (process.env.SEED_TENANT_CODE || 'JPKM').trim().toUpperCase();

async function main() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  const tenant = await Tenant.findOne({ code: TENANT_CODE });
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_CODE}`);

  // This catches the earlier bad Google import bug where the spreadsheet "Code" column
  // was mapped as SKU instead of "SKU CODE", creating numeric SKUs like 1, 2, 11, 12.
  const query = {
    tenantId: tenant._id,
    skuCode: { $regex: /^\d+$/ },
    isDeleted: { $ne: true },
  };

  const badItems = await StoreItem.find(query, { skuCode: 1, itemName: 1, stocks: 1 }).sort({ skuCode: 1 }).lean();
  console.log(`Found ${badItems.length} numeric-only SKU item(s).`);
  badItems.slice(0, 30).forEach((item) => console.log(`- ${item.skuCode}: ${item.itemName} (${(item.stocks || []).length} stock rows)`));

  if (process.env.CONFIRM_CLEAN_BAD_GOOGLE_ITEMS !== 'true') {
    console.log('\nDry run only. To soft-delete these wrong imports, run:');
    console.log('CONFIRM_CLEAN_BAD_GOOGLE_ITEMS=true npm run cleanup:bad-google-item-import');
    await mongoose.disconnect();
    return;
  }

  const result = await StoreItem.updateMany(query, { $set: { isDeleted: true, isActive: false } });
  console.log(`Soft-deleted ${result.modifiedCount || 0} bad numeric-SKU item(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
