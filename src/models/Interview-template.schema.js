// interview-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const QuestionSchema = new Schema(
  {
    area: { type: String, trim: true }, // e.g., 'System Design'
    question: { type: String, required: true, trim: true },
    weight: { type: Number, default: 10 },
    scale: { type: String, enum: ['1-5', '1-10'], default: '1-5' },
  },
  { _id: false }
);

const StageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // 'Technical Round'
    durationMinutes: { type: Number, default: 60 },
    questions: { type: [QuestionSchema], default: [] },
  },
  { _id: false }
);

const InterviewTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    stages: { type: [StageSchema], default: [] },
    tags: { type: [String], default: [] },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'interview_templates' }
);

InterviewTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('InterviewTemplate', InterviewTemplateSchema);