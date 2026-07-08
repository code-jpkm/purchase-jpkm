// loan-advance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const InstallmentSchema = new Schema(
  {
    periodKey: { type: String, required: true, trim: true }, // "YYYY-MM"
    dueAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    payslipId: { type: Types.ObjectId, ref: 'Payslip' },
    paidAt: { type: Date },
    status: { type: String, enum: ['due', 'partial', 'paid', 'skipped'], default: 'due' },
  },
  { _id: false }
);

const LoanAdvanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    type: { type: String, enum: ['loan', 'advance'], required: true, index: true },

    principal: { type: Number, required: true },
    interestRateAnnualPercent: { type: Number, default: 0 },
    emiAmount: { type: Number, required: true },
    startPeriodKey: { type: String, required: true, trim: true }, // "YYYY-MM"
    tenureMonths: { type: Number, required: true },

    balance: { type: Number, required: true }, // remaining principal
    recoveryComponentId: { type: Types.ObjectId, ref: 'PayrollComponent', required: true },

    installments: { type: [InstallmentSchema], default: [] },

    status: { type: String, enum: ['active', 'closed', 'written-off'], default: 'active', index: true },
    closedAt: { type: Date },

    notes: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'loans_advances' }
);

LoanAdvanceSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

module.exports = mongoose.model('LoanAdvance', LoanAdvanceSchema);