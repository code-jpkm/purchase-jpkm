// data-retention-policy.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DataRetentionPolicySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    entityType: { type: String, required: true, trim: true },
    retentionDays: { type: Number, required: true }, // days before archive/delete
    action: { type: String, enum: ['archive', 'soft-delete', 'hard-delete'], default: 'archive' },

    excludeIfTagged: { type: Boolean, default: true },
    excludeTags: { type: [String], default: [] },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'data_retention_policies' }
);

DataRetentionPolicySchema.index({ tenantId: 1, entityType: 1 }, { unique: true });

module.exports = mongoose.model('DataRetentionPolicy', DataRetentionPolicySchema);