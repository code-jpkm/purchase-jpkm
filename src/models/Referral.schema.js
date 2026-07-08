// referral.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ReferralSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    referringEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    candidateId: { type: Types.ObjectId, ref: 'Candidate', required: true, index: true },
    openingId: { type: Types.ObjectId, ref: 'JobOpening', index: true },

    message: { type: String, trim: true },
    status: { type: String, enum: ['submitted', 'hired', 'rejected', 'bonus-paid'], default: 'submitted', index: true },
    bonusAmount: { type: Number, default: 0 },
    bonusPaidAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'referrals' }
);

ReferralSchema.index({ tenantId: 1, candidateId: 1, referringEmployeeId: 1 }, { unique: true });

module.exports = mongoose.model('Referral', ReferralSchema);