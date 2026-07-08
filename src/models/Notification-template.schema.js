// notification-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ChannelConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    subject: { type: String, trim: true }, // for email
    body: { type: String, trim: true },    // handlebars/DSL
    smsText: { type: String, trim: true },
    pushTitle: { type: String, trim: true },
    pushBody: { type: String, trim: true },
  },
  { _id: false }
);

const NotificationTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    key: { type: String, required: true, trim: true, lowercase: true }, // e.g., 'leave.approved'
    name: { type: String, required: true, trim: true },

    channels: {
      email: { type: ChannelConfigSchema, default: {} },
      sms: { type: ChannelConfigSchema, default: {} },
      push: { type: ChannelConfigSchema, default: {} },
      inapp: { type: ChannelConfigSchema, default: {} },
    },

    defaultAudience: {
      toUserIds: [{ type: Types.ObjectId, ref: 'User' }],
      toRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],
    },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'notification_templates' }
);

NotificationTemplateSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('NotificationTemplate', NotificationTemplateSchema);