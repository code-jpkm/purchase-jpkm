const mongoose = require('mongoose');
const { Schema } = mongoose;

const FloorMaterialBalanceSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  year: { type: Number, required: true, index: true },
  foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
  department: { type: String, required: true, trim: true },
  skuCode: { type: String, required: true, trim: true, uppercase: true },
  itemName: { type: String, required: true, trim: true },
  itemType: { type: String, trim: true },
  motherItem: { type: String, trim: true },
  uom: { type: String, trim: true },
  floorLeftQty: { type: Number, default: 0, min: 0 },
  countedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  countedByName: { type: String, trim: true },
  countedAt: { type: Date, default: Date.now },
  remarks: { type: String, trim: true },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: 'floor_material_balances' });

FloorMaterialBalanceSchema.index({ tenantId: 1, year: 1, month: 1, foundry: 1, department: 1, skuCode: 1 }, { unique: true });
module.exports = mongoose.model('FloorMaterialBalance', FloorMaterialBalanceSchema);
