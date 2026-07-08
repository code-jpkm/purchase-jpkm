// exit-interview.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ResponseSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, trim: true },
    rating: { type: Number }, // optional score
  },
  { _id: false }
);

const ExitInterviewSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    separationId: { type: Types.ObjectId, ref: 'Separation', required: true, index: true },

    interviewerUserId: { type: Types.ObjectId, ref: 'User' },
    interviewAt: { type: Date },
    responses: { type: [ResponseSchema], default: [] },

    summary: { type: String, trim: true },
    recommendations: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'exit_interviews' }
);

ExitInterviewSchema.index({ tenantId: 1, separationId: 1 }, { unique: true });

module.exports = mongoose.model('ExitInterview', ExitInterviewSchema);