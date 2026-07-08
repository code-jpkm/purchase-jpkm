// asset-type.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AssetTypeSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    depreciation: {
      method: { type: String, enum: ['none', 'straight-line', 'wdv'], default: 'none' },
      rateAnnualPercent: { type: Number, default: 0 },
      salvageValuePercent: { type: Number, default: 0 },
    },

    warrantyMonths: { type: Number, default: 0 },
    serialTracking: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'asset_types' }
);

AssetTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('AssetType', AssetTypeSchema);