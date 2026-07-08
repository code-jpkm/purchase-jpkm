
const mongoose = require('mongoose');
const { Schema } = mongoose;
const TYPES = ['Raw Material', 'Chemical', 'Packing Material', 'Hard Coke', 'Paint', 'Stores', 'Grinding Wheel', 'Fire Wood', 'Lime Stone', 'Repair', 'Capital'];

const MotherItemSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true, uppercase: true },
  itemType: { type: String, enum: TYPES, default: 'Stores', index: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: 'mother_items' });

MotherItemSchema.index({ tenantId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('MotherItem', MotherItemSchema);
