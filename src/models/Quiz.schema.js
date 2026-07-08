// quiz.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const QuizQuestionSchema = new Schema(
  {
    prompt: { type: String, required: true, trim: true },
    type: { type: String, enum: ['mcq-single', 'mcq-multi', 'true-false'], default: 'mcq-single' },
    options: [{ type: String }],
    correctIndexes: [{ type: Number }],
    weight: { type: Number, default: 1 },
  },
  { _id: false }
);

const QuizSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    questions: { type: [QuizQuestionSchema], default: [] },
    passPercent: { type: Number, default: 60 },
    durationMinutes: { type: Number, default: 30 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'quizzes' }
);

QuizSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Quiz', QuizSchema);