// talent-review.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const TalentReviewSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    cycleId: { type: Types.ObjectId, ref: 'PerformanceCycle', index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    performanceScore: { type: Number, default: 0 },
    potentialScore: { type: Number, default: 0 },
    nineBox: { type: String, trim: true }, // label computed from scores
    successionReadyInMonths: { type: Number, default: 0 },
    comments: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'talent_reviews' }
);

TalentReviewSchema.index({ tenantId: 1, cycleId: 1, employeeId: 1 }, { unique: true });
module.exports = mongoose.model('TalentReview', TalentReviewSchema);