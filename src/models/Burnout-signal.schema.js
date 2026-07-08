// burnout-signal.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const BurnoutSignalSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    periodKey: { type: String, required: true, trim: true }, // "2025-W22" or "2025-05"
    score: { type: Number, min: 0, max: 100, default: 0 },   // computed
    factors: Schema.Types.Mixed, // e.g., longHours, weekendWork, noLeave, negativePulse, etc.

    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low', index: true },
    actionSuggested: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'burnout_signals' }
);

BurnoutSignalSchema.index({ tenantId: 1, employeeId: 1, periodKey: 1 }, { unique: true });
module.exports = mongoose.model('BurnoutSignal', BurnoutSignalSchema);