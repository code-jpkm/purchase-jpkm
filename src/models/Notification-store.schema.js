const mongoose = require('mongoose');
const { Schema } = mongoose;

const StoreNotificationSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'LOW_STOCK',
        'ZERO_STOCK',
        'INDENT_SUBMITTED',
        'PO_ISSUED',
        'GRN_RECEIVED',
        'QC_FAILED',
        'BUDGET_OVERRUN',
        'BUDGET_UNDERRUN',
        'BUDGET_PO_WARNING',
        'PO_FOLLOWUP',
        'DELIVERY_DUE',
        'RETURN_MATERIAL',
        'DEBIT_NOTE',
        'CREDIT_NOTE',
        'HIGH_STOCK_PO_WARNING',
        'FMS_DUE_TODAY',
        'FMS_DUE_TOMORROW',
        'FMS_OVERDUE',
        'USER_CREATED',
        'HELP_TICKET',
        'COST_INCREASE',
        'AI_ALERT',
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    referenceModel: {
      type: String,
      enum: ['StoreItem', 'Indent', 'PurchaseOrder', 'GoodsReceipt', 'Budget', 'StoreOutward', 'User', 'HelpTicket', 'CostingRun', 'UserTask', 'AIConversation'],
    },
    referenceId: { type: Schema.Types.ObjectId },
    referenceNo: { type: String },

    // Delivery channels
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    emailRecipients: [{ type: String }],
    whatsappSent: { type: Boolean, default: false },
    whatsappSentAt: { type: Date },
    whatsappRecipients: [{ type: String }],

    // In-app
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    targetUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  },
  { timestamps: true, versionKey: false, collection: 'store_notifications' }
);

StoreNotificationSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
StoreNotificationSchema.index({ tenantId: 1, targetUsers: 1 });

module.exports = mongoose.model('StoreNotification', StoreNotificationSchema);
