// webhook-subscription.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Outbound webhooks for tenant events (e.g., attendance.created, payslip.published).
 */
const WebhookSubscriptionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    eventKey: { type: String, required: true, trim: true, lowercase: true }, // e.g., 'attendance.event.created'
    targetUrl: { type: String, required: true, trim: true },
    secret: { type: String, required: true, trim: true },

    isActive: { type: Boolean, default: true, index: true },
    retryPolicy: {
      maxAttempts: { type: Number, default: 6 },
      backoffStrategy: { type: String, enum: ['exponential', 'linear'], default: 'exponential' },
    },
    headers: { type: Map, of: String, default: {} },

    createdByUserId: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false, collection: 'webhook_subscriptions' }
);

WebhookSubscriptionSchema.index({ tenantId: 1, eventKey: 1, targetUrl: 1 }, { unique: true });

module.exports = mongoose.model('WebhookSubscription', WebhookSubscriptionSchema);