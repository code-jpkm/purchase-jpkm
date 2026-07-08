// leave-accrual-log.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Immutable accrual transactions for audit.
 */
const LeaveAccrualLogSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    leaveTypeId: { type: Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    policyId: { type: Types.ObjectId, ref: 'LeavePolicy', required: true },

    periodKey: { type: String, required: true, trim: true, index: true },

    txnDate: { type: Date, required: true, index: true },
    units: { type: Number, required: true }, // +ve for credit, -ve for debit
    reason: {
      type: String,
      enum: ['accrual', 'carry-forward', 'adjustment', 'year-close', 'policy-change', 'rollback'],
      default: 'accrual',
      index: true,
    },

    source: { type: String, enum: ['system', 'manual'], default: 'system' },
    refId: { type: Types.ObjectId }, // optional link to batch/process

    createdByUserId: { type: Types.ObjectId, ref: 'User' },

    // No soft-delete for accrual logs; immutable. If correction, create counter-entry.
  },
  { timestamps: true, versionKey: false, collection: 'leave_accrual_logs' }
);

LeaveAccrualLogSchema.index({ tenantId: 1, employeeId: 1, txnDate: 1 });

module.exports = mongoose.model('LeaveAccrualLog', LeaveAccrualLogSchema);