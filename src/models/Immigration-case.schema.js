 // immigration-case.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const MilestoneSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    dueAt: { type: Date },
    completedAt: { type: Date },
    status: { type: String, enum: ['pending', 'completed', 'overdue'], default: 'pending' },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const ImmigrationCaseSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    country: { type: String, required: true, trim: true },
    visaType: { type: String, required: true, trim: true },
    caseNumber: { type: String, trim: true },

    startAt: { type: Date },
    expiresAt: { type: Date, index: true },
    status: { type: String, enum: ['draft', 'filed', 'approved', 'rejected', 'expired'], default: 'draft', index: true },

    milestones: { type: [MilestoneSchema], default: [] },
    documents: [{ type: Types.ObjectId, ref: 'EmployeeDocument' }],
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'immigration_cases' }
);

ImmigrationCaseSchema.index({ tenantId: 1, employeeId: 1, country: 1, visaType: 1 });
module.exports = mongoose.model('ImmigrationCase', ImmigrationCaseSchema);