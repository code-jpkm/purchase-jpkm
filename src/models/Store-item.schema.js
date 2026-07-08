const mongoose = require('mongoose');
const { Schema } = mongoose;

// Per-foundry/department stock entry for a single SKU
const FoundryDeptStockSchema = new Schema(
  {
    foundry: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    dailyAvgConsumptionLow: { type: Number, default: 0 },
    dailyAvgConsumptionNormal: { type: Number, default: 0 },
    dailyAvgConsumptionPeak: { type: Number, default: 0 },
    currentSeason: { type: String, enum: ['Low', 'Normal', 'Peak'], default: 'Normal' },
    leadTime: { type: Number, default: 0 }, // days
    safetyFactor: { type: Number, default: 1 },
    maxLevel: { type: Number, default: 0 },
    openingStockQty: { type: Number, default: 0 },
    currentQty: { type: Number, default: 0 }, // live stock
    interDeptTransferQty: { type: Number, default: 0 },
    outwardFormType: { type: String, default: 'OUTWARD FORM' },
    interDeptTransferFormType: { type: String, default: 'INTER DEPARTMENT TRANSFER FORM' },
    qtyInDepartment: { type: Number, default: 0 },
    documentLink: { type: String },
    sendToMonthlyStock: { type: Boolean, default: false },
    motherItem: { type: String },
  },
  { _id: false }
);

const StoreItemSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: Number }, // sequential code (1, 2, 3...)
    skuCode: { type: String, required: true, trim: true, uppercase: true },
    itemName: { type: String, required: true, trim: true },
    hsnCode: { type: String, trim: true },
    gstPercent: { type: Number, default: 0 },
    uomId: { type: Schema.Types.ObjectId, ref: 'Uom' },
    uom: { type: String, required: true, trim: true }, // primary UOM
    secondaryUomId: { type: Schema.Types.ObjectId, ref: 'Uom' },
    secondaryUom: { type: String, trim: true },
    secondaryUomFormula: { type: String, trim: true }, // formula to convert secondary → primary
    itemType: {
      type: String,
      enum: ['Raw Material', 'Chemical', 'Packing Material', 'Hard Coke', 'Paint', 'Stores', 'Grinding Wheel', 'Fire Wood', 'Lime Stone', 'Repair', 'Capital'],
      default: 'Stores',
      index: true,
    },
    motherItemId: { type: Schema.Types.ObjectId, ref: 'MotherItem' },
    motherItem: { type: String, trim: true, index: true },
    productCategory: {
      type: String,
      enum: ['STORE', 'CHEMICAL', 'ELECTRICAL', 'MECHANICAL', 'CONSUMABLE', 'OTHER'],
      default: 'STORE',
    },
    preference: { type: Number, default: 2 }, // 1 = priority chemical, 2 = normal
    rate: { type: Number, default: 0 }, // last purchase rate
    salePrice: { type: Number, default: 0 },
    profitPercent: { type: Number, default: 0 },
    lastVendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    lastVendorName: { type: String },
    lastPurchaseDate: { type: Date },
    totalAvailableQty: { type: Number, default: 0 }, // aggregate across all foundry/dept
    // Per foundry+department stock breakdown
    stocks: [FoundryDeptStockSchema],
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'store_items',
  }
);

StoreItemSchema.index({ tenantId: 1, skuCode: 1 }, { unique: true });
StoreItemSchema.index({ tenantId: 1, itemName: 1 });
StoreItemSchema.index({ tenantId: 1, productCategory: 1 });
StoreItemSchema.index({ tenantId: 1, itemType: 1, motherItem: 1 });
StoreItemSchema.index({ tenantId: 1, isDeleted: 1, isActive: 1 });

// Recompute totalAvailableQty from all stocks
StoreItemSchema.methods.recalcTotal = function () {
  this.totalAvailableQty = this.stocks.reduce((sum, s) => sum + (s.currentQty || 0), 0);
};

module.exports = mongoose.model('StoreItem', StoreItemSchema);
