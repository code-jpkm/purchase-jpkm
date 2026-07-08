// payout-transaction.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * One payout to a beneficiary (usually tied to a payslip). Uses gateway provider.
 */
const PayoutTransactionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true, required: true },

    gatewayAccountId: { type: Types.ObjectId, ref: 'PayoutGatewayAccount', required: true, index: true },
    provider: { type: String, required: true, trim: true, lowercase: true }, // 'phonepe'

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    payslipId: { type: Types.ObjectId, ref: 'Payslip', index: true },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', index: true },

    beneficiaryId: { type: Types.ObjectId, ref: 'PayoutBeneficiary', required: true, index: true },
    method: { type: String, enum: ['upi', 'bank'], required: true },

    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    narration: { type: String, trim: true }, // "Salary May-2025"

    status: { type: String, enum: ['queued', 'processing', 'pending', 'succeeded', 'failed', 'reversed'], default: 'queued', index: true },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    settledAt: { type: Date },

    providerTxnId: { type: String, trim: true, index: true },
    providerBatchId: { type: String, trim: true },
    utr: { type: String, trim: true }, // bank UTR or provider ref
    errorCode: { type: String, trim: true },
    errorMessage: { type: String, trim: true },

    metadata: Schema.Types.Mixed,
  },
  { timestamps: true, versionKey: false, collection: 'payout_transactions' }
);

PayoutTransactionSchema.index({ tenantId: 1, provider: 1, status: 1, requestedAt: 1 });
module.exports = mongoose.model('PayoutTransaction', PayoutTransactionSchema);