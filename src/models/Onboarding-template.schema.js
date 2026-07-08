// onboarding-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const TaskSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assigneeType: { type: String, enum: ['employee', 'manager', 'role', 'hr'], default: 'employee' },
    roleId: { type: Types.ObjectId, ref: 'Role' },
    dueInDays: { type: Number, default: 7 }, // after start date
    requiresDocumentTypeId: { type: Types.ObjectId, ref: 'DocumentType' },
    attachmentRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const OnboardingTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    tasks: { type: [TaskSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'onboarding_templates' }
);

OnboardingTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('OnboardingTemplate', OnboardingTemplateSchema);