const mongoose = require('mongoose');
const { Schema } = mongoose;

const AiMonitorFindingSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    category: { type: String, enum: ['STOCK', 'PURCHASE', 'GRN', 'FMS', 'BUDGET', 'COSTING', 'VENDOR', 'DATA_QUALITY', 'GOOGLE_SHEETS', 'AI'], required: true, index: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM', index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    actionRequired: { type: String, trim: true },
    ownerName: { type: String, trim: true },
    referenceModel: { type: String, trim: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceNo: { type: String, trim: true },
    status: { type: String, enum: ['Open', 'Acknowledged', 'Resolved', 'Ignored'], default: 'Open', index: true },
    generatedBy: { type: String, enum: ['RULE_ENGINE', 'GEMINI', 'MANUAL'], default: 'RULE_ENGINE' },
    score: { type: Number, default: 0 },
    meta: Schema.Types.Mixed,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'ai_monitor_findings' }
);

AiMonitorFindingSchema.index({ tenantId: 1, status: 1, severity: 1, createdAt: -1 });
module.exports = mongoose.model('AiMonitorFinding', AiMonitorFindingSchema);
