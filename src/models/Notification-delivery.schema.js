// notification-delivery.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Per-channel, per-recipient delivery records (email/SMS/push/in-app).
 */
const NotificationDeliverySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    messageId: { type: Types.ObjectId, ref: 'NotificationMessage', required: true, index: true },

    channel: { type: String, enum: ['email', 'sms', 'push', 'inapp'], required: true, index: true },
    toUserId: { type: Types.ObjectId, ref: 'User', index: true },
    toAddress: { type: String, trim: true }, // email/phone/token if no user

    subject: { type: String, trim: true },
    body: { type: String, trim: true },

    status: { type: String, enum: ['queued', 'sent', 'failed', 'read'], default: 'queued', index: true },
    providerMessageId: { type: String, trim: true },
    error: { type: String, trim: true },
    sentAt: { type: Date },
    readAt: { type: Date },

    // In-app only
    inapp: {
      actionUrl: { type: String, trim: true },
      icon: { type: String, trim: true },
      importance: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    },
  },
  { timestamps: true, versionKey: false, collection: 'notification_deliveries' }
);

NotificationDeliverySchema.index({ tenantId: 1, toUserId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('NotificationDelivery', NotificationDeliverySchema);