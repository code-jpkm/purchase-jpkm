// quiz-attempt.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AttemptAnswerSchema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    selectedIndexes: [{ type: Number, required: true }],
    correct: { type: Boolean, default: false },
  },
  { _id: false }
);

const QuizAttemptSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    quizId: { type: Types.ObjectId, ref: 'Quiz', required: true, index: true },
    courseId: { type: Types.ObjectId, ref: 'Course' },

    scorePercent: { type: Number, default: 0 },
    passed: { type: Boolean, default: false, index: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },

    answers: { type: [AttemptAnswerSchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'quiz_attempts' }
);

QuizAttemptSchema.index({ tenantId: 1, employeeId: 1, quizId: 1, startedAt: 1 });
module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);