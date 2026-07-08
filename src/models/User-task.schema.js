const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserTaskSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    userWhatsapp: { type: String, trim: true },
    buddyUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    buddyUserName: { type: String, trim: true },
    buddyUserEmail: { type: String, trim: true },
    buddyUserWhatsapp: { type: String, trim: true },
    fmsType: { type: String, enum: ['indent', 'po', 'grn'], required: true, index: true },
    referenceModel: { type: String, enum: ['Indent', 'PurchaseOrder', 'GoodsReceipt'], required: true },
    referenceId: { type: Schema.Types.ObjectId, required: true, index: true },
    referenceNo: { type: String, trim: true },
    stepKey: { type: String, required: true },
    stepWhat: { type: String, required: true },
    stepHow: { type: String, trim: true },
    plannedAt: { type: Date, index: true },
    actualAt: { type: Date },
    status: { type: String, default: 'Pending', index: true },
    link: { type: String, trim: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    lastNotifiedAt: { type: Date },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'user_tasks' }
);

UserTaskSchema.index({ tenantId: 1, userId: 1, status: 1, plannedAt: 1 });
UserTaskSchema.index({ tenantId: 1, referenceId: 1, stepKey: 1 }, { unique: true });

module.exports = mongoose.model('UserTask', UserTaskSchema);
