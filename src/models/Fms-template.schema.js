const mongoose = require('mongoose');
const { Schema } = mongoose;

const FmsTemplateStepSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 1 },
    what: { type: String, required: true, trim: true },
    who: { type: String, trim: true },
    how: { type: String, trim: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedUserName: { type: String, trim: true },
    assignedUserEmail: { type: String, trim: true },
    assignedUserWhatsapp: { type: String, trim: true },
    buddyUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    buddyUserName: { type: String, trim: true },
    buddyUserEmail: { type: String, trim: true },
    buddyUserWhatsapp: { type: String, trim: true },
    tatDays: { type: Number, default: null }, // Google Sheet style: 0.083333 = 2 hrs, 1 = one working day
    plannedMode: { type: String, enum: ['tat', 'next_day_10', 'manual', 'none'], default: 'tat' },
    statusOptions: { type: [String], default: ['Pending', 'Yes', 'No'] },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const FmsTemplateSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    flowType: { type: String, required: true, enum: ['indent', 'po', 'grn'], index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    steps: { type: [FmsTemplateStepSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'fms_templates' }
);

FmsTemplateSchema.index({ tenantId: 1, flowType: 1 }, { unique: true });

module.exports = mongoose.model('FmsTemplate', FmsTemplateSchema);
