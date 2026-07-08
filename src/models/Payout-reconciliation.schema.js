// payout-reconciliation.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Reconciliation sheets between HRMS computed payouts and provider reports.
 */
const PayoutReconciliationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    provider: { type: String, required: true, trim: true, lowercase: true },
    periodKey: { type: String, required: true, trim: true, index: true }, // "2025-05"
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', index: true },

    totals: {
      expectedCount: { type: Number, default: 0 },
      expectedAmount: { type: Number, default: 0 },
      providerCount: { type: Number, default: 0 },
      providerAmount: { type: Number, default: 0 },
      differenceCount: { type: Number, default: 0 },
      differenceAmount: { type: Number, default: 0 },
    },

    mismatches: [
      {
        payslipId: { type: Types.ObjectId, ref: 'Payslip' },
        transactionId: { type: Types.ObjectId, ref: 'PayoutTransaction' },
        providerTxnId: { type: String, trim: true },
        expectedAmount: { type: Number },
        actualAmount: { type: Number },
        status: { type: String, trim: true },
        note: { type: String, trim: true },
      },
    ],

    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'payout_reconciliations' }
);

PayoutReconciliationSchema.index({ tenantId: 1, provider: 1, periodKey: 1 }, { unique: true });
module.exports = mongoose.model('PayoutReconciliation', PayoutReconciliationSchema);