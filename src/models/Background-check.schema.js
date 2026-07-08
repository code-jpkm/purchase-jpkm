// background-check.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CheckItemSchema = new Schema(
  {
    type: { type: String, required: true, trim: true }, // 'education', 'employment', 'criminal', 'address'
    status: { type: String, enum: ['pending', 'in-progress', 'clear', 'adverse', 'inconclusive'], default: 'pending' },
    reportUrl: { type: String, trim: true },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const BackgroundCheckSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    candidateId: { type: Types.ObjectId, ref: 'Candidate', required: true, index: true },
    applicationId: { type: Types.ObjectId, ref: 'Application', required: true, index: true },

    vendor: { type: String, trim: true },
    caseId: { type: String, trim: true },

    checks: { type: [CheckItemSchema], default: [] },
    status: { type: String, enum: ['not-started', 'in-progress', 'completed', 'adverse'], default: 'not-started', index: true },

    completedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'background_checks' }
);

BackgroundCheckSchema.index({ tenantId: 1, applicationId: 1 }, { unique: true });

module.exports = mongoose.model('BackgroundCheck', BackgroundCheckSchema);