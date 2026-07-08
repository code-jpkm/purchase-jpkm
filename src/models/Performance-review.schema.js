// performance-review.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AnswerSchema = new Schema(
  {
    questionCode: { type: String, required: true, trim: true, uppercase: true },
    rating: { type: Number },
    text: { type: String, trim: true },
  },
  { _id: false }
);

const RaterEntrySchema = new Schema(
  {
    raterType: { type: String, enum: ['self', 'manager', 'peer', 'skip', 'direct-report'], required: true },
    raterEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile' },
    invitedAt: { type: Date },
    submittedAt: { type: Date },
    answers: { type: [AnswerSchema], default: [] },
    overallComment: { type: String, trim: true },
    overallScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const PerformanceReviewSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cycleId: { type: Types.ObjectId, ref: 'PerformanceCycle', required: true, index: true },

    templateId: { type: Types.ObjectId, ref: 'PerformanceReviewTemplate', required: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    raters: { type: [RaterEntrySchema], default: [] },
    normalizedScore: { type: Number, default: 0 },

    calibrationStatus: { type: String, enum: ['pending', 'in-review', 'finalized'], default: 'pending', index: true },
    finalRating: { type: Number },
    finalComment: { type: String, trim: true },

    status: { type: String, enum: ['draft', 'in-progress', 'completed', 'locked'], default: 'in-progress', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    locked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'performance_reviews' }
);

PerformanceReviewSchema.index({ tenantId: 1, cycleId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('PerformanceReview', PerformanceReviewSchema);