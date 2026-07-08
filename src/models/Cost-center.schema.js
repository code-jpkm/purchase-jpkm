// cost-center.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CostCenterSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    parentCostCenterId: { type: Types.ObjectId, ref: 'CostCenter', default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'cost_centers' }
);

CostCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });
CostCenterSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('CostCenter', CostCenterSchema);