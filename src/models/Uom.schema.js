
const mongoose = require('mongoose');
const { Schema } = mongoose;

const UomSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: 'uoms' });

UomSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Uom', UomSchema);
