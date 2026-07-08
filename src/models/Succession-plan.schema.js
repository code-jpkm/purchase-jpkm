// succession-plan.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CandidateSchema = new Schema(
  {
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true },
    readinessMonths: { type: Number, default: 0 },
    developmentPlan: { type: String, trim: true },
  },
  { _id: false }
);

const SuccessionPlanSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    positionId: { type: Types.ObjectId, ref: 'Position', required: true, index: true },
    candidates: { type: [CandidateSchema], default: [] },
    status: { type: String, enum: ['draft', 'approved'], default: 'draft', index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'succession_plans' }
);

SuccessionPlanSchema.index({ tenantId: 1, positionId: 1 }, { unique: true });
module.exports = mongoose.model('SuccessionPlan', SuccessionPlanSchema);