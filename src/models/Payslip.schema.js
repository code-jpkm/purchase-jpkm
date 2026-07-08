// payslip.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const LineSchema = new Schema(
  {
    componentId: { type: Types.ObjectId, ref: 'PayrollComponent', required: true },
    code: { type: String, required: true, trim: true, uppercase: true }, // snapshot for audit
    name: { type: String, required: true, trim: true },                  // snapshot
    amount: { type: Number, required: true },
    quantity: { type: Number },
    rate: { type: Number },
    sequence: { type: Number, default: 100 },
  },
  { _id: false }
);

const SnapshotBankSchema = new Schema(
  {
    accountHolder: String,
    accountNumber: String,
    ifsc: String,
    bankName: String,
    branch: String,
    upiId: String,
  },
  { _id: false }
);

const PayslipSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    salaryStructureId: { type: Types.ObjectId, ref: 'SalaryStructure' },

    earnings: { type: [LineSchema], default: [] },
    deductions: { type: [LineSchema], default: [] },
    employerContributions: { type: [LineSchema], default: [] }, // PF/ESI employer share if shown

    gross: { type: Number, required: true, default: 0 },
    totalDeductions: { type: Number, required: true, default: 0 },
    net: { type: Number, required: true, default: 0 },

    workedDays: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },

    taxDetails: {
      taxableGross: { type: Number, default: 0 },
      tdsAmount: { type: Number, default: 0 },
      regime: { type: String, enum: ['old', 'new'], default: 'new' },
    },

    pf: {
      employee: { type: Number, default: 0 },
      employer: { type: Number, default: 0 },
      uan: { type: String, trim: true },
    },
    esi: {
      employee: { type: Number, default: 0 },
      employer: { type: Number, default: 0 },
      ipNumber: { type: String, trim: true },
    },
    pt: { amount: { type: Number, default: 0 }, state: { type: String, trim: true } },

    bank: { type: SnapshotBankSchema, default: {} },

    published: { type: Boolean, default: false, index: true },
    pdfUrl: { type: String, trim: true },

    locked: { type: Boolean, default: false, index: true },
    payoutBatchId: { type: Types.ObjectId, ref: 'BankPayoutBatch' },

    notes: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false, collection: 'payslips' }
);

PayslipSchema.index({ tenantId: 1, payrollPeriodId: 1, employeeId: 1 }, { unique: true });
PayslipSchema.index({ tenantId: 1, published: 1 });

module.exports = mongoose.model('Payslip', PayslipSchema);