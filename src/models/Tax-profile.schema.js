// tax-profile.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PreviousEmploymentSchema = new Schema(
  {
    employerName: { type: String, trim: true },
    fromMonth: { type: String, trim: true }, // "YYYY-MM"
    toMonth: { type: String, trim: true },
    grossIncome: { type: Number, default: 0 },
    tdsDeducted: { type: Number, default: 0 },
    proofUrls: { type: [String], default: [] },
  },
  { _id: false }
);

const RentDetailsSchema = new Schema(
  {
    monthlyRent: { type: Number, default: 0 },
    cityCategory: { type: String, enum: ['metro', 'non-metro'], default: 'non-metro' },
    landlordName: { type: String, trim: true },
    landlordPan: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
    fromMonth: { type: String, trim: true },
    toMonth: { type: String, trim: true },
    receiptUrls: { type: [String], default: [] },
  },
  { _id: false }
);

const TaxProfileSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true }, // "2025-2026"

    regime: { type: String, enum: ['old', 'new'], default: 'new' },
    pan: { type: String, trim: true, uppercase: true },
    residentStatus: { type: String, enum: ['resident', 'non-resident', 'rnor'], default: 'resident' },
    disabilityPercent: { type: Number, default: 0 },

    hra: { type: RentDetailsSchema, default: {} },
    otherIncome: {
      interestIncome: { type: Number, default: 0 },
      rentalIncome: { type: Number, default: 0 },
      capitalGains: { type: Number, default: 0 },
      others: { type: Number, default: 0 },
    },

    previousEmployment: { type: PreviousEmploymentSchema, default: {} },

    declarationLocked: { type: Boolean, default: false, index: true },
    proofsSubmitted: { type: Boolean, default: false, index: true },
    proofsVerifiedAt: { type: Date },

    notes: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false, collection: 'tax_profiles' }
);

TaxProfileSchema.index({ tenantId: 1, employeeId: 1, fiscalYear: 1 }, { unique: true });

module.exports = mongoose.model('TaxProfile', TaxProfileSchema);