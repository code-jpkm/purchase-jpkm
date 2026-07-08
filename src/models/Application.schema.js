// application.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const StageHistorySchema = new Schema(
  {
    stage: { type: String, required: true, trim: true },
    byUserId: { type: Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    comment: { type: String, trim: true },
  },
  { _id: false }
);

const ApplicationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    openingId: { type: Types.ObjectId, ref: 'JobOpening', required: true, index: true },
    candidateId: { type: Types.ObjectId, ref: 'Candidate', required: true, index: true },

    currentStage: {
      type: String,
      enum: ['applied', 'screening', 'assignment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'],
      default: 'applied',
      index: true,
    },
    score: { type: Number, default: 0 },
    ownerUserId: { type: Types.ObjectId, ref: 'User' }, // recruiter

    attachments: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    history: { type: [StageHistorySchema], default: [] },

    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'applications' }
);

ApplicationSchema.index({ tenantId: 1, openingId: 1, candidateId: 1 }, { unique: true });

module.exports = mongoose.model('Application', ApplicationSchema);