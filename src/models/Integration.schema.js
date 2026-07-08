// integration.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * External integrations registry (biometric vendors, email/SMS, accounting, SSO, etc).
 * Note: Encrypt sensitive credentials at rest.
 */
const IntegrationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    type: {
      type: String,
      required: true,
      // e.g., 'biometric.zkteco', 'email.sendgrid', 'sms.twilio', 'slack', 'accounting.tally', 'sso.okta'
    },
    name: { type: String, trim: true },
    credentials: { type: Map, of: String, default: {} }, // encrypted fields recommended
    config: { type: Map, of: String, default: {} },

    status: { type: String, enum: ['connected', 'error', 'disabled'], default: 'connected', index: true },
    lastHealthCheckAt: { type: Date },
    lastHealthCheckError: { type: String, trim: true },

    isActive: { type: Boolean, default: true, index: true },
    createdByUserId: { type: Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'integrations' }
);

IntegrationSchema.index({ tenantId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Integration', IntegrationSchema);