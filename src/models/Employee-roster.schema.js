// employee-roster.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Holds assigned shifts per employee for a date range.
 * assignments are daily and can come from manual, template, or spotlight.
 */
const AssignmentSchema = new Schema(
  {
    date: { type: Date, required: true }, // normalized to 00:00 local
    shiftId: { type: Types.ObjectId, ref: 'Shift' },
    off: { type: Boolean, default: false },
    source: { type: String, enum: ['manual', 'template', 'spotlight', 'auto'], default: 'manual' },
    assignedByUserId: { type: Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
    locked: { type: Boolean, default: false }, // prevent post-payroll edits
  },
  { _id: false }
);

const EmployeeRosterSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    validFrom: { type: Date, required: true, index: true },
    validTo: { type: Date, required: true, index: true },

    templateId: { type: Types.ObjectId, ref: 'RosterTemplate' },
    assignments: { type: [AssignmentSchema], default: [] },

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'employee_rosters' }
);

EmployeeRosterSchema.index({ tenantId: 1, employeeId: 1, validFrom: 1, validTo: 1 });
EmployeeRosterSchema.index({ tenantId: 1, validFrom: 1, validTo: 1 });

module.exports = mongoose.model('EmployeeRoster', EmployeeRosterSchema);