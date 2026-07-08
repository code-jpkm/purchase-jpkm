const mongoose = require('mongoose');
const { Schema } = mongoose;

const CostingLineSchema = new Schema({
  section: { type: String, required: true, trim: true },
  source: { type: String, enum: ['STORE', 'MANUAL'], default: 'STORE' },
  itemType: { type: String, trim: true },
  motherItem: { type: String, trim: true },
  skuCode: { type: String, trim: true },
  itemName: { type: String, required: true, trim: true },
  uom: { type: String, trim: true },
  rate: { type: Number, default: 0 },
  outwardQty: { type: Number, default: 0 },
  floorLeftQty: { type: Number, default: 0 },
  consumedQty: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  costPerTon: { type: Number, default: 0 },
  costPerKg: { type: Number, default: 0 },
  consumptionPercent: { type: Number, default: 0 },
  notes: { type: String, trim: true },
}, { _id: true });

const CostingRunSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  costingNo: { type: String, required: true },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  year: { type: Number, required: true, index: true },
  costingType: { type: String, enum: ['GREEN_SAND', 'NO_BAKE'], required: true, index: true },
  foundry: { type: String, enum: ['D. I', 'C. I'], default: 'D. I' },
  department: { type: String, trim: true },
  datePrepared: { type: Date, default: Date.now },
  preparedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  preparedByName: { type: String, trim: true },

  totalWorkingDays: { type: Number, default: 0 },
  totalHeats: { type: Number, default: 0 },
  averageHeat: { type: Number, default: 0 },
  liquidMetalMt: { type: Number, default: 0 },
  productionWtMt: { type: Number, default: 0 },
  rejectionWtMt: { type: Number, default: 0 },
  goodCastingWtMt: { type: Number, required: true, min: 0 },
  noBakeProductionMt: { type: Number, default: 0 },
  totalProductionMt: { type: Number, default: 0 },
  yieldPercent: { type: Number, default: 0 },
  rejectionPercent: { type: Number, default: 0 },

  costOfProduction: { type: Number, default: 0 },
  costOfSales: { type: Number, default: 0 },
  materialCostPerKg: { type: Number, default: 0 },
  conversionCostPerKg: { type: Number, default: 0 },
  powerCostPerKg: { type: Number, default: 0 },
  totalInputCostPerTon: { type: Number, default: 0 },
  totalInputCostPerKg: { type: Number, default: 0 },

  lines: { type: [CostingLineSchema], default: [] },
  manualLines: { type: [CostingLineSchema], default: [] },
  salesLines: { type: [CostingLineSchema], default: [] },
  remarks: { type: String, trim: true },
  status: { type: String, enum: ['Draft', 'Finalized'], default: 'Draft' },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: 'costing_runs' });

CostingRunSchema.index({ tenantId: 1, costingType: 1, year: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('CostingRun', CostingRunSchema);
