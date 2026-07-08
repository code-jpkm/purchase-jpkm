// benefit-claim.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Claims against a benefit plan or flex wallet category.
 */
const BenefitClaimSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },

    planId: { type: Types.ObjectId, ref: 'BenefitPlan' }, // optional if using wallet category only
    optionCode: { type: String, trim: true, uppercase: true },
    walletCategoryCode: { type: String, trim: true, uppercase: true },

    dependentId: { type: Types.ObjectId, ref: 'EmployeeDependent' },
    serviceDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    description: { type: String, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['submitted', 'approved', 'rejected', 'paid', 'cancelled'], default: 'submitted', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    paidAt: { type: Date },
    payoutReference: { type: String, trim: true },

    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'benefit_claims' }
);

BenefitClaimSchema.index({ tenantId: 1, employeeId: 1, fiscalYear: 1, status: 1 });

module.exports = mongoose.model('BenefitClaim', BenefitClaimSchema);