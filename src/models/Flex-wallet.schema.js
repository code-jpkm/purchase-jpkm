// flex-wallet.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Flexi-benefits wallet: allocate annual budget; employees spend across categories with simple claims.
 */
const CategoryAllocationSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g., 'WELLNESS', 'LTA'
    name: { type: String, required: true, trim: true },
    capAmount: { type: Number, default: 0 },
    rolloverPercent: { type: Number, default: 0 }, // carry forward at year-end
  },
  { _id: false }
);

const WalletTxnSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    categoryCode: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, enum: ['credit', 'debit', 'rollback'], required: true },
    amount: { type: Number, required: true },
    refId: { type: Types.ObjectId }, // link to claim or adjustment
    comment: { type: String, trim: true },
  },
  { _id: false }
);

const FlexWalletSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },

    currency: { type: String, default: 'INR' },
    annualBudget: { type: Number, required: true, default: 0 },
    categories: { type: [CategoryAllocationSchema], default: [] },

    balance: { type: Number, required: true, default: 0 },
    txns: { type: [WalletTxnSchema], default: [] },

    locked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'flex_wallets' }
);

FlexWalletSchema.index({ tenantId: 1, employeeId: 1, fiscalYear: 1 }, { unique: true });

module.exports = mongoose.model('FlexWallet', FlexWalletSchema);