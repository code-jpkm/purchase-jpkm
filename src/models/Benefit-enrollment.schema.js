// benefit-enrollment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const BenefitEnrollmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },
    planId: { type: Types.ObjectId, ref: 'BenefitPlan', required: true, index: true },
    optionCode: { type: String, required: true, trim: true, uppercase: true },

    dependentIds: [{ type: Types.ObjectId, ref: 'EmployeeDependent' }],

    premiumEmployee: { type: Number, required: true, default: 0 },
    premiumEmployer: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'INR' },

    status: { type: String, enum: ['selected', 'approved', 'active', 'cancelled', 'terminated'], default: 'selected', index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date },

    enrollmentWindowId: { type: Types.ObjectId, ref: 'OpenEnrollmentWindow' },
    qleReason: { type: String, trim: true }, // Qualifying Life Event reason if mid-year

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'benefit_enrollments' }
);

BenefitEnrollmentSchema.index({ tenantId: 1, employeeId: 1, fiscalYear: 1, planId: 1 }, { unique: true });

module.exports = mongoose.model('BenefitEnrollment', BenefitEnrollmentSchema);