require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/Tenant.schema');
const StoreItem = require('../models/Store-item.schema');
const { buildItemLocationFilter } = require('./inventory-query');

(async () => {
  await connectDB();
  const tenantCode = (process.env.SEED_TENANT_CODE || 'JPKM').toUpperCase();
  const tenant = await Tenant.findOne({ code: tenantCode, isDeleted: { $ne: true } });
  if (!tenant) throw new Error(`Tenant not found for code ${tenantCode}. Run npm run seed first.`);

  const tenantId = tenant._id;
  await StoreItem.updateMany({ tenantId, isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  await StoreItem.updateMany({ tenantId, isActive: { $exists: false } }, { $set: { isActive: true } });

  const allItems = await StoreItem.find({ tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } });
  let fixedTotals = 0;
  for (const item of allItems) {
    const total = (item.stocks || []).reduce((sum, s) => sum + Number(s.currentQty || 0), 0);
    if (Number(item.totalAvailableQty || 0) !== total) {
      item.totalAvailableQty = total;
      await item.save();
      fixedTotals += 1;
    }
  }

  const diNoBakeFilter = buildItemLocationFilter('D. I', 'CASTING (NO BAKE)');
  const diNoBakeCount = await StoreItem.countDocuments({ tenantId, isDeleted: { $ne: true }, isActive: { $ne: false }, ...(diNoBakeFilter ? { $and: [diNoBakeFilter] } : {}) });
  const samples = await StoreItem.find({ tenantId, isDeleted: { $ne: true }, isActive: { $ne: false }, ...(diNoBakeFilter ? { $and: [diNoBakeFilter] } : {}) }, { skuCode: 1, itemName: 1, stocks: 1 }).limit(10);

  console.log('\nInventory doctor');
  console.log('──────────────────────────────────────');
  console.log('Database            :', process.env.DB_NAME || '(from MONGO_URI)');
  console.log('Tenant              :', tenant.code, String(tenant._id));
  console.log('Active store items  :', allItems.length);
  console.log('Totals recalculated :', fixedTotals);
  console.log('D. I / CASTING (NO BAKE) item dropdown count:', diNoBakeCount);
  samples.forEach((item, index) => {
    const stock = (item.stocks || []).find((s) => /D\.?\s*I/i.test(s.foundry) && String(s.department).toUpperCase() === 'CASTING (NO BAKE)');
    console.log(`${index + 1}. ${item.itemName} | ${item.skuCode} | stock ${stock?.currentQty ?? 0}`);
  });
  if (!allItems.length || !diNoBakeCount) {
    console.log('\nACTION NEEDED: run npm run seed, then restart backend. The item dropdown is empty because matching inventory rows are not present for this tenant/database.');
  } else {
    console.log('\nInventory dropdown data looks OK. Restart backend and refresh frontend.');
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Inventory doctor failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
