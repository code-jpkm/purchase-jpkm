// payout-webhook-event.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Inbound events from payment provider to update payout status (idempotent processing).
 */
const PayoutWebhookEventSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    provider: { type: String, required: true, trim: true, lowercase: true },
    gatewayAccountId: { type: Types.ObjectId, ref: 'PayoutGatewayAccount', index: true },

    eventKey: { type: String, required: true, trim: true }, // e.g., 'payout.success'
    payload: Schema.Types.Mixed,
    signature: { type: String, trim: true },
    receivedAt: { type: Date, default: Date.now, index: true },

    providerTxnId: { type: String, trim: true, index: true },
    providerBatchId: { type: String, trim: true },

    processed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date },
    processingError: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'payout_webhook_events' }
);

PayoutWebhookEventSchema.index({ tenantId: 1, provider: 1, receivedAt: 1 });
module.exports = mongoose.model('PayoutWebhookEvent', PayoutWebhookEventSchema);