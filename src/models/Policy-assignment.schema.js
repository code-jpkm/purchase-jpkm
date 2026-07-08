// policy-assignment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Generic policy assignment to scopes (company/location/department/designation/employee).
 * Use for attendance, leave, payroll, workflow, weekoff, etc. (Holiday calendar has its own assignment but can be unified here as well.)
 */
const PolicyRefSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['AttendancePolicy', 'LeavePolicy', 'PayrollPeriodTemplate', 'Workflow', 'WeekOffRule', 'HolidayCalendar'],
    },
    id: { type: Types.ObjectId, required: true },
  },
  { _id: false }
);

const PolicyAssignmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    policy: { type: PolicyRefSchema, required: true, index: true },

    scopeType: { type: String, enum: ['company', 'location', 'department', 'designation', 'employee'], required: true, index: true },
    scopeId: { type: Types.ObjectId, index: true }, // null for company scope

    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date }, // null=open-ended

    isPrimary: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },

    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'policy_assignments' }
);

PolicyAssignmentSchema.index(
  { tenantId: 1, 'policy.type': 1, 'policy.id': 1, scopeType: 1, scopeId: 1, effectiveFrom: 1 },
  { unique: false }
);

module.exports = mongoose.model('PolicyAssignment', PolicyAssignmentSchema);