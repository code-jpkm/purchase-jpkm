// webhook-delivery.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Delivery attempts per subscription per event.
 */
const WebhookDeliverySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    subscriptionId: { type: Types.ObjectId, ref: 'WebhookSubscription', required: true, index: true },
    eventId: { type: Types.ObjectId, ref: 'WebhookEvent', required: true, index: true },

    status: { type: String, enum: ['queued', 'sent', 'failed', 'succeeded', 'retrying'], default: 'queued', index: true },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, index: true },
    nextAttemptAt: { type: Date, index: true },
    responseStatus: { type: Number },
    responseBody: { type: String, trim: true },
    error: { type: String, trim: true },
    signature: { type: String, trim: true }, // HMAC of payload for verification
  },
  { timestamps: true, versionKey: false, collection: 'webhook_deliveries' }
);

WebhookDeliverySchema.index({ tenantId: 1, status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('WebhookDelivery', WebhookDeliverySchema);