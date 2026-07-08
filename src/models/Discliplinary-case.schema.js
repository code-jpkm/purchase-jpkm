// disciplinary-case.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ActionSchema = new Schema(
  {
    type: { type: String, enum: ['warning', 'suspension', 'termination', 'other'], required: true },
    comment: { type: String, trim: true },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
  },
  { _id: false }
);

const DisciplinaryCaseSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    openedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true },

    status: { type: String, enum: ['open', 'inquiry', 'closed'], default: 'open', index: true },
    actions: { type: [ActionSchema], default: [] },
    attachments: { type: [String], default: [] },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
  },
  { timestamps: true, versionKey: false, collection: 'disciplinary_cases' }
);

DisciplinaryCaseSchema.index({ tenantId: 1, employeeId: 1, status: 1, openedAt: 1 });
module.exports = mongoose.model('DisciplinaryCase', DisciplinaryCaseSchema);