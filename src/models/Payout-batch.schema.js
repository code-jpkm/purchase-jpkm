// payout-batch.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Batch multiple payout transactions into a single provider batch call.
 */
const PayoutBatchSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true, required: true },

    gatewayAccountId: { type: Types.ObjectId, ref: 'PayoutGatewayAccount', required: true, index: true },
    provider: { type: String, required: true, trim: true, lowercase: true },

    name: { type: String, required: true, trim: true }, // "May-2025 Salary - UPI"
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod', required: true, index: true },

    transactionIds: [{ type: Types.ObjectId, ref: 'PayoutTransaction' }],
    totalCount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    status: { type: String, enum: ['draft', 'submitted', 'partial', 'succeeded', 'failed'], default: 'draft', index: true },
    providerBatchId: { type: String, trim: true },
    submittedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'payout_batches' }
);

PayoutBatchSchema.index({ tenantId: 1, provider: 1, payrollPeriodId: 1, status: 1 });
module.exports = mongoose.model('PayoutBatch', PayoutBatchSchema);