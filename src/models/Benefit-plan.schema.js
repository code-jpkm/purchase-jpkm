// benefit-plan.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Benefit plan with options and eligibility; supports medical/dental/life/parental/etc.
 */
const PlanOptionSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    premiumEmployee: { type: Number, default: 0 },
    premiumEmployer: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    coverageAmount: { type: Number, default: 0 },
    deductible: { type: Number, default: 0 },
  },
  { _id: false }
);

const EligibilitySchema = new Schema(
  {
    employmentTypes: {
      type: [String],
      enum: ['permanent', 'contract', 'intern', 'part-time'],
      default: ['permanent', 'contract', 'intern', 'part-time'],
    },
    minTenureDays: { type: Number, default: 0 },
    locations: [{ type: Types.ObjectId, ref: 'Location' }],
    grades: [{ type: String }],
  },
  { _id: false }
);

const EnrollmentRulesSchema = new Schema(
  {
    requireDependents: { type: Boolean, default: false },
    waitingPeriodDays: { type: Number, default: 0 },
    allowMidYearQLE: { type: Boolean, default: true }, // Qualifying Life Event
  },
  { _id: false }
);

const BenefitPlanSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    type: { type: String, enum: ['medical', 'dental', 'vision', 'life', 'parental', 'wellness', 'other'], required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },

    options: { type: [PlanOptionSchema], default: [] },
    eligibility: { type: EligibilitySchema, default: {} },
    enrollment: { type: EnrollmentRulesSchema, default: {} },

    provider: { type: String, trim: true },
    policyNumber: { type: String, trim: true },

    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'benefit_plans' }
);

BenefitPlanSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('BenefitPlan', BenefitPlanSchema);