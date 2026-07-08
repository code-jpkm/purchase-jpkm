// payroll-payout-preference.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Per-employee payout preferences for payroll (gateway vs bank, fallback, split if needed).
 */
const PayrollPayoutPreferenceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, unique: true, index: true },
    method: { type: String, enum: ['gateway', 'bank-file'], default: 'gateway', index: true },
    beneficiaryId: { type: Types.ObjectId, ref: 'PayoutBeneficiary' },
    allowFallbackToBankFile: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'payroll_payout_preferences' }
);

module.exports = mongoose.model('PayrollPayoutPreference', PayrollPayoutPreferenceSchema);