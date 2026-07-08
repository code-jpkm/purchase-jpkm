// grievance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const GrievanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    category: { type: String, required: true, trim: true }, // 'harassment', 'pay', etc.
    description: { type: String, required: true, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['submitted', 'in-review', 'resolved', 'rejected'], default: 'submitted', index: true },
    ownerUserId: { type: Types.ObjectId, ref: 'User' },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    outcome: { type: String, trim: true },
    outcomeAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'grievances' }
);

GrievanceSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
module.exports = mongoose.model('Grievance', GrievanceSchema);