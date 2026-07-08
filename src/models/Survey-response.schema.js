// survey-response.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AnswerSchema = new Schema(
  {
    questionCode: { type: String, required: true, trim: true, uppercase: true },
    value: Schema.Types.Mixed, // number/string/bool
  },
  { _id: false }
);

const SurveyResponseSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    surveyId: { type: Types.ObjectId, ref: 'Survey', required: true, index: true },
    respondentEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', index: true },

    submittedAt: { type: Date, default: Date.now },
    answers: { type: [AnswerSchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'survey_responses' }
);

SurveyResponseSchema.index({ tenantId: 1, surveyId: 1, respondentEmployeeId: 1 }, { unique: true, partialFilterExpression: { respondentEmployeeId: { $type: 'objectId' } } });
module.exports = mongoose.model('SurveyResponse', SurveyResponseSchema);