// webhook-event.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Immutable event payload recorded before delivery attempts.
 */
const WebhookEventSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    eventKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityRef: {
      type: { type: String },
      id: { type: Types.ObjectId },
    },
    payload: Schema.Types.Mixed,
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'webhook_events' }
);

WebhookEventSchema.index({ tenantId: 1, eventKey: 1, occurredAt: 1 });

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);