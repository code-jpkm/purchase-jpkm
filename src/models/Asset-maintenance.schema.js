// asset-maintenance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AssetMaintenanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    assetId: { type: Types.ObjectId, ref: 'Asset', required: true, index: true },
    type: { type: String, enum: ['preventive', 'repair', 'inspection'], default: 'repair', index: true },
    vendor: { type: String, trim: true },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },

    cost: { type: Number, default: 0 },
    details: { type: String, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'asset_maintenance' }
);

AssetMaintenanceSchema.index({ tenantId: 1, assetId: 1, status: 1 });

module.exports = mongoose.model('AssetMaintenance', AssetMaintenanceSchema);