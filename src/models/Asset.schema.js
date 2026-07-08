// asset.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AssetSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    typeId: { type: Types.ObjectId, ref: 'AssetType', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true }, // unique per tenant
    name: { type: String, required: true, trim: true },
    serialNumber: { type: String, trim: true, index: true },
    purchaseDate: { type: Date, index: true },
    purchaseCost: { type: Number, default: 0 },
    supplier: { type: String, trim: true },

    locationId: { type: Types.ObjectId, ref: 'Location' },
    status: { type: String, enum: ['in-stock', 'assigned', 'maintenance', 'retired', 'lost'], default: 'in-stock', index: true },

    warrantyExpiry: { type: Date },
    insurancePolicy: { type: String, trim: true },
    attachments: { type: [String], default: [] },

    currentAssignmentId: { type: Types.ObjectId, ref: 'AssetAssignment' },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'assets' }
);

AssetSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Asset', AssetSchema);