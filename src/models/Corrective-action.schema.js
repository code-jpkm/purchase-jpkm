// corrective-action.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CorrectiveActionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    incidentId: { type: Types.ObjectId, ref: 'SafetyIncident', required: true, index: true },
    ownerUserId: { type: Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true },

    dueAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    status: { type: String, enum: ['open', 'in-progress', 'completed', 'overdue'], default: 'open', index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'corrective_actions' }
);

CorrectiveActionSchema.index({ tenantId: 1, status: 1, dueAt: 1 });
module.exports = mongoose.model('CorrectiveAction', CorrectiveActionSchema);