// job-requisition.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Internal request to open roles (headcount/budget approval). Feeds JobOpening.
 */
const JobRequisitionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true },
    departmentId: { type: Types.ObjectId, ref: 'Department', required: true, index: true },
    locationId: { type: Types.ObjectId, ref: 'Location', index: true },
    positionId: { type: Types.ObjectId, ref: 'Position' }, // if Workforce Planning module is used
    grade: { type: String, trim: true },

    headcountRequested: { type: Number, required: true, default: 1 },
    headcountApproved: { type: Number, default: 0 },
    replacementForEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile' },

    employmentType: { type: String, enum: ['permanent', 'contract', 'intern', 'part-time'], default: 'permanent' },
    minExperienceYears: { type: Number, default: 0 },
    maxExperienceYears: { type: Number },

    budgetCurrency: { type: String, default: 'INR' },
    budgetAnnualMin: { type: Number },
    budgetAnnualMax: { type: Number },

    justification: { type: String, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'closed'], default: 'submitted', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    requestedByUserId: { type: Types.ObjectId, ref: 'User', required: true },
    decidedByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'job_requisitions' }
);

JobRequisitionSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('JobRequisition', JobRequisitionSchema);