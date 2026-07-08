// points-wallet.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PointsTxnSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, enum: ['credit', 'debit', 'rollback'], required: true },
    points: { type: Number, required: true },
    refType: { type: String, trim: true }, // 'kudos', 'redemption'
    refId: { type: Types.ObjectId },
    comment: { type: String, trim: true },
  },
  { _id: false }
);

const PointsWalletSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    balance: { type: Number, default: 0 },
    txns: { type: [PointsTxnSchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'points_wallets' }
);

PointsWalletSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
module.exports = mongoose.model('PointsWallet', PointsWalletSchema);