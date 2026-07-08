// bank-payout-batch.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PayoutItemSchema = new Schema(
  {
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true },
    payslipId: { type: Types.ObjectId, ref: 'Payslip', required: true },
    amount: { type: Number, required: true },
    bankSnapshot: {
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
      branch: String,
      upiId: String,
    },
    status: { type: String, enum: ['pending', 'submitted', 'paid', 'failed', 'reversed'], default: 'pending' },
    utr: { type: String, trim: true }, // bank reference no.
    error: { type: String, trim: true }
  },
  { _id: false }
);

const BankPayoutBatchSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., "Apr-2025 Salary Batch #1"

    items: { type: [PayoutItemSchema], default: [] },
    totalAmount: { type: Number, default: 0 },

    fileUrl: { type: String, trim: true }, // bank file generated
    submittedAt: { type: Date },
    settledAt: { type: Date },

    status: { type: String, enum: ['draft', 'generated', 'submitted', 'settled', 'failed'], default: 'draft', index: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false, collection: 'bank_payout_batches' }
);

BankPayoutBatchSchema.index({ tenantId: 1, payrollPeriodId: 1, status: 1 });

module.exports = mongoose.model('BankPayoutBatch', BankPayoutBatchSchema);