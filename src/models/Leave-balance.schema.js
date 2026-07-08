// leave-balance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Tracks balances by employee, leave type, and period (e.g., fiscal year).
 * All updates should go through accrual/allocation/request/encashment logs for auditability.
 */
const LeaveBalanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    leaveTypeId: { type: Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    policyId: { type: Types.ObjectId, ref: 'LeavePolicy', required: true },

    periodKey: { type: String, required: true, trim: true, index: true }, // e.g., "FY-2025-2026" or "CY-2025"

    openingBalance: { type: Number, default: 0 },
    accrued: { type: Number, default: 0 },
    manualCredits: { type: Number, default: 0 },
    manualDebits: { type: Number, default: 0 },
    consumed: { type: Number, default: 0 },
    encashed: { type: Number, default: 0 },
    lapsed: { type: Number, default: 0 },

    pendingApproval: { type: Number, default: 0 }, // pending requests not yet deducted
    closingBalance: { type: Number, default: 0 }, // computed snapshot

    lastAccrualAt: { type: Date },
    lastRecomputeAt: { type: Date },

    locked: { type: Boolean, default: false, index: true }, // end-of-year or payroll lock
    notes: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_balances' }
);

LeaveBalanceSchema.index(
  { tenantId: 1, employeeId: 1, leaveTypeId: 1, periodKey: 1 },
  { unique: true }
);

module.exports = mongoose.model('LeaveBalance', LeaveBalanceSchema);