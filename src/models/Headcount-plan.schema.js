// headcount-plan.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const HeadcountPlanSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },
    departmentId: { type: Types.ObjectId, ref: 'Department', required: true, index: true },

    positions: [
      {
        positionId: { type: Types.ObjectId, ref: 'Position', required: true },
        planned: { type: Number, default: 0 },
        budgetAnnualPerHead: { type: Number, default: 0 },
      },
    ],
    status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'headcount_plans' }
);

HeadcountPlanSchema.index({ tenantId: 1, fiscalYear: 1, departmentId: 1 }, { unique: true });
module.exports = mongoose.model('HeadcountPlan', HeadcountPlanSchema);