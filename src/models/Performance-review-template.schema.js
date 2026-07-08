// performance-review-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const QuestionSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    text: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['rating-5', 'rating-10', 'text', 'boolean'], default: 'rating-5' },
    weight: { type: Number, default: 10 },
    competency: { type: String, trim: true }, // e.g., 'Leadership', 'Teamwork'
  },
  { _id: false }
);

const PerformanceReviewTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    sections: [
      {
        title: { type: String, required: true, trim: true },
        weight: { type: Number, default: 50 },
        questions: { type: [QuestionSchema], default: [] },
      },
    ],

    raterModel: {
      self: { type: Boolean, default: true },
      manager: { type: Boolean, default: true },
      peerCount: { type: Number, default: 0 },
      skipLevel: { type: Boolean, default: false },
      directReports: { type: Boolean, default: false },
    },

    ratingScale: { type: String, enum: ['1-5', '1-10'], default: '1-5' },
    normalizeScores: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'performance_review_templates' }
);

PerformanceReviewTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('PerformanceReviewTemplate', PerformanceReviewTemplateSchema);