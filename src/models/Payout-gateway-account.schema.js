// payout-gateway-account.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Tracks gateway account linkage (uses Integration for credentials, this stores runtime state).
 * Example providers: 'phonepe', 'razorpayx', 'cashfree'.
 */
const PayoutGatewayAccountSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true, required: true },

    provider: { type: String, required: true, trim: true, lowercase: true }, // 'phonepe'
    integrationId: { type: Types.ObjectId, ref: 'Integration', required: true, index: true },

    merchantId: { type: String, trim: true },
    accountLabel: { type: String, trim: true },

    currency: { type: String, default: 'INR' },
    balanceSnapshot: { type: Number, default: 0 },
    balanceRefreshedAt: { type: Date },

    status: { type: String, enum: ['connected', 'error', 'disabled'], default: 'connected', index: true },
    lastError: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'payout_gateway_accounts' }
);

PayoutGatewayAccountSchema.index({ tenantId: 1, provider: 1 }, { unique: true });
module.exports = mongoose.model('PayoutGatewayAccount', PayoutGatewayAccountSchema);