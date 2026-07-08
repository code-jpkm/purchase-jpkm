// api-key.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * API keys for tenant-level programmatic access (webhooks consumer, external apps).
 * Store only hashed keys.
 */
const ApiKeySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, index: true }, // hash of API key
    scopes: [{ type: String }], // e.g., 'attendance:read', 'payroll:write'
    expiresAt: { type: Date },
    lastUsedAt: { type: Date },
    lastUsedIp: { type: String, trim: true },

    isActive: { type: Boolean, default: true, index: true },
    createdByUserId: { type: Types.ObjectId, ref: 'User' },
    revokedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'api_keys' }
);

ApiKeySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ApiKey', ApiKeySchema);