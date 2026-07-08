// daily-attendance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Derived from attendance_events + rosters + policies.
 * Keep fields needed by payroll, BI, and audits. Lock when payroll processed.
 */
const PunchPairSchema = new Schema(
  {
    inAt: { type: Date, required: true },
    outAt: { type: Date },
    source: { type: String, enum: ['biometric', 'web', 'mobile', 'api', 'mixed'], default: 'biometric' },
    durationMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const DailyAttendanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    date: { type: Date, required: true, index: true }, // normalized local date start

    shiftId: { type: Types.ObjectId, ref: 'Shift' },
    rosterSource: { type: String, enum: ['manual', 'template', 'spotlight', 'auto', null], default: null },
    policyId: { type: Types.ObjectId, ref: 'AttendancePolicy' },

    status: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'leave', 'weekoff', 'holiday'],
      required: true,
      index: true,
    },

    firstInAt: { type: Date },
    lastOutAt: { type: Date },
    punchPairs: { type: [PunchPairSchema], default: [] },

    workMinutes: { type: Number, default: 0 },
    payableMinutes: { type: Number, default: 0 }, // after policy adjustments
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },

    nightShift: { type: Boolean, default: false },
    crossMidnight: { type: Boolean, default: false },

    events: [{ type: Types.ObjectId, ref: 'AttendanceEvent' }],
    computeVersion: { type: Number, default: 1 },
    computedAt: { type: Date },

    notes: { type: String, trim: true },
    locked: { type: Boolean, default: false, index: true },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod' },

    isEdited: { type: Boolean, default: false },
    editedByUserId: { type: Types.ObjectId, ref: 'User' },
    editReason: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'daily_attendance' }
);

DailyAttendanceSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
DailyAttendanceSchema.index({ tenantId: 1, date: 1, status: 1 });
DailyAttendanceSchema.index({ tenantId: 1, payrollPeriodId: 1, locked: 1 });

module.exports = mongoose.model('DailyAttendance', DailyAttendanceSchema);