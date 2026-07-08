// payout-beneficiary.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Beneficiary records for gateway payouts (UPI VPA or bank in fallback).
 */
const PayoutBeneficiarySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },

    method: { type: String, enum: ['upi', 'bank'], required: true, index: true },

    upi: {
      vpa: { type: String, trim: true, lowercase: true }, // e.g., name@bank
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
    },

    bank: {
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
    },

    preferred: { type: Boolean, default: true, index: true },
    active: { type: Boolean, default: true, index: true },
    providerRef: { type: String, trim: true }, // provider beneficiary id if needed
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'payout_beneficiaries' }
);

PayoutBeneficiarySchema.index({ tenantId: 1, employeeId: 1, preferred: 1 });
module.exports = mongoose.model('PayoutBeneficiary', PayoutBeneficiarySchema);