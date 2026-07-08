// interview-feedback.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AreaScoreSchema = new Schema(
  {
    area: { type: String, trim: true },
    score: { type: Number, default: 0 },
    comment: { type: String, trim: true },
  },
  { _id: false }
);

const InterviewFeedbackSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    scheduleId: { type: Types.ObjectId, ref: 'InterviewSchedule', required: true, index: true },
    reviewerUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    overallScore: { type: Number, default: 0 },
    recommendation: { type: String, enum: ['strong-hire', 'hire', 'no-hire', 'hold'], default: 'hold', index: true },
    strengths: { type: String, trim: true },
    concerns: { type: String, trim: true },

    areaScores: { type: [AreaScoreSchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'interview_feedback' }
);

InterviewFeedbackSchema.index({ tenantId: 1, scheduleId: 1, reviewerUserId: 1 }, { unique: true });

module.exports = mongoose.model('InterviewFeedback', InterviewFeedbackSchema);