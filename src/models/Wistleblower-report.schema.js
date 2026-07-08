// whistleblower-report.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const WhistleblowerReportSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    anonymous: { type: Boolean, default: false, index: true },
    reporterUserId: { type: Types.ObjectId, ref: 'User' },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['submitted', 'investigating', 'closed'], default: 'submitted', index: true },
    assignedToUserId: { type: Types.ObjectId, ref: 'User' },
    outcome: { type: String, trim: true },
    outcomeAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'whistleblower_reports' }
);

WhistleblowerReportSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
module.exports = mongoose.model('WhistleblowerReport', WhistleblowerReportSchema);