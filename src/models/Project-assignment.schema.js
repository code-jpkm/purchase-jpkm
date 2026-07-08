// project-assignment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ProjectAssignmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    projectId: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    role: { type: String, trim: true }, // e.g., 'Developer', 'QA'

    rateCardId: { type: Types.ObjectId, ref: 'RateCard' }, // override project default
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date },

    allocationPercent: { type: Number, default: 100 },
    status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'project_assignments' }
);

ProjectAssignmentSchema.index({ tenantId: 1, projectId: 1, employeeId: 1, effectiveFrom: 1 }, { unique: true });

module.exports = mongoose.model('ProjectAssignment', ProjectAssignmentSchema);