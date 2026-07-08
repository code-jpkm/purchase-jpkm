// survey.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SurveyQuestionSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    text: { type: String, required: true, trim: true },
    type: { type: String, enum: ['likert-5', 'likert-7', 'nps', 'text', 'boolean'], default: 'likert-5' },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const SurveySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    anonymous: { type: Boolean, default: true },
    questions: { type: [SurveyQuestionSchema], default: [] },

    audience: {
      locations: [{ type: Types.ObjectId, ref: 'Location' }],
      departments: [{ type: Types.ObjectId, ref: 'Department' }],
      designations: [{ type: Types.ObjectId, ref: 'Designation' }],
    },

    status: { type: String, enum: ['draft', 'open', 'closed'], default: 'draft', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'surveys' }
);

SurveySchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Survey', SurveySchema);