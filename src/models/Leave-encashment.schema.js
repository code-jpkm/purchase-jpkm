// leave-encashment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Leave encashment request and settlement. Tied to payroll if processed.
 */

const LeaveEncashmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    leaveTypeId: { type: Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    policyId: { type: Types.ObjectId, ref: 'LeavePolicy', required: true },

    periodKey: { type: String, required: true, trim: true },

    requestedUnits: { type: Number, required: true },
    approvedUnits: { type: Number },
    valuationMethod: {
      type: String,
      enum: ['basic-percent', 'ctc-percent', 'fixed-per-day', 'per-day-based-on-payroll-component'],
      required: true,
    },
    perDayRate: { type: Number }, // computed
    amount: { type: Number },     // computed total

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    requestedByUserId: { type: Types.ObjectId, ref: 'User', required: true },
    decidedByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    decisionComment: { type: String, trim: true },

    processedAt: { type: Date },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod' },
    payslipId: { type: Types.ObjectId, ref: 'Payslip' },

    attachments: { type: [String], default: [] },

    locked: { type: Boolean, default: false, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_encashments' }
);

LeaveEncashmentSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

module.exports = mongoose.model('LeaveEncashment', LeaveEncashmentSchema);