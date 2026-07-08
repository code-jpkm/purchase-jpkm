// payroll-input.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Variable pay inputs/adjustments per employee for a period (bonus, OT hours, arrears, deductions).
 */
const PayrollInputSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    componentId: { type: Types.ObjectId, ref: 'PayrollComponent', required: true, index: true },

    amount: { type: Number, required: true }, // positive for earning, negative for deduction if needed
    quantity: { type: Number },               // e.g., OT hours, days for arrear
    rate: { type: Number },                   // optional derived rate
    reason: { type: String, trim: true },

    source: { type: String, enum: ['manual', 'api', 'import', 'system'], default: 'manual', index: true },
    attachmentUrls: { type: [String], default: [] },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    locked: { type: Boolean, default: false, index: true }, // locked once payslip generated
    createdByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'payroll_inputs' }
);

PayrollInputSchema.index({ tenantId: 1, payrollPeriodId: 1, employeeId: 1 });

module.exports = mongoose.model('PayrollInput', PayrollInputSchema);