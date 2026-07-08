// payroll-run.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PayrollRunSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    sequence: { type: Number, default: 1 }, // multiple runs for same period if needed

    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued', index: true },
    scope: {
      employeeIds: [{ type: Types.ObjectId, ref: 'EmployeeProfile' }],
      departments: [{ type: Types.ObjectId, ref: 'Department' }],
      locations: [{ type: Types.ObjectId, ref: 'Location' }],
    },

    computeVersion: { type: Number, default: 1 },
    metrics: {
      employeesProcessed: { type: Number, default: 0 },
      totalGross: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      totalNet: { type: Number, default: 0 },
    },
    logsUrl: { type: String, trim: true },

    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false, collection: 'payroll_runs' }
);

PayrollRunSchema.index({ tenantId: 1, payrollPeriodId: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);