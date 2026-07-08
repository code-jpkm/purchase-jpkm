// notification-message.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * One logical notification; expands into deliveries per channel/recipient.
 */

const NotificationMessageSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    templateKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityRef: {
      type: {
        type: String,
        // e.g., 'LeaveRequest'
      },
      id: { type: Types.ObjectId },
    },

    payload: Schema.Types.Mixed, // template variables

    audience: {
      toUserIds: [{ type: Types.ObjectId, ref: 'User', index: true }],
      toRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],
    },

    channels: { type: [String], enum: ['email', 'sms', 'push', 'inapp'], default: ['inapp'] },

    status: { type: String, enum: ['queued', 'processing', 'sent', 'partial', 'failed'], default: 'queued', index: true },
    queuedAt: { type: Date, default: Date.now },
    sentAt: { type: Date },

    error: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'notification_messages' }
);

NotificationMessageSchema.index({ tenantId: 1, status: 1, queuedAt: 1 });

module.exports = mongoose.model('NotificationMessage', NotificationMessageSchema);