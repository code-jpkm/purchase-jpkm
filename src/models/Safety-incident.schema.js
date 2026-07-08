// safety-incident.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SafetyIncidentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    reportedByUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
    locationId: { type: Types.ObjectId, ref: 'Location' },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low', index: true },
    category: { type: String, trim: true }, // 'slip', 'electrical', etc.

    description: { type: String, required: true, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['reported', 'investigating', 'resolved', 'closed'], default: 'reported', index: true },
    correctiveActionId: { type: Types.ObjectId, ref: 'CorrectiveAction' },
  },
  { timestamps: true, versionKey: false, collection: 'safety_incidents' }
);

SafetyIncidentSchema.index({ tenantId: 1, status: 1, occurredAt: 1 });
module.exports = mongoose.model('SafetyIncident', SafetyIncidentSchema);