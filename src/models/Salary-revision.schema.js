// salary-revision.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SalaryRevisionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    oldStructureId: { type: Types.ObjectId, ref: 'SalaryStructure' },
    newStructureId: { type: Types.ObjectId, ref: 'SalaryStructure', required: true },

    effectiveFrom: { type: Date, required: true, index: true },
    reason: { type: String, trim: true }, // annual increment/promotion/correction
    arrearApplicable: { type: Boolean, default: true },
    arrearFromDate: { type: Date }, // for retroactive pay
    arrearToDate: { type: Date },

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'applied'], default: 'pending', index: true },
    decidedByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },

    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'salary_revisions' }
);

SalaryRevisionSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: 1 });

module.exports = mongoose.model('SalaryRevision', SalaryRevisionSchema);