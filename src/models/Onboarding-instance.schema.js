// onboarding-instance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const InstanceTaskSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    assigneeUserId: { type: Types.ObjectId, ref: 'User' },
    dueAt: { type: Date },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'blocked', 'cancelled'], default: 'pending' },
    completedAt: { type: Date },
    attachmentUrls: { type: [String], default: [] },
    comment: { type: String, trim: true },
  },
  { _id: false }
);

const OnboardingInstanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    templateId: { type: Types.ObjectId, ref: 'OnboardingTemplate', required: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    startDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['not-started', 'in-progress', 'completed', 'cancelled'], default: 'not-started', index: true },

    tasks: { type: [InstanceTaskSchema], default: [] },
    progressPercent: { type: Number, default: 0 },

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
  },
  { timestamps: true, versionKey: false, collection: 'onboarding_instances' }
);

OnboardingInstanceSchema.index({ tenantId: 1, employeeId: 1, startDate: 1 });

module.exports = mongoose.model('OnboardingInstance', OnboardingInstanceSchema);