// coaching-insight.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CoachingInsightSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    topic: { type: String, required: true, trim: true }, // e.g., 'prioritize leave', 'reduce meetings'
    summary: { type: String, required: true, trim: true },
    actions: [{ type: String }],
    sourceSignals: Schema.Types.Mixed, // references to signals/charts
  },
  { timestamps: true, versionKey: false, collection: 'coaching_insights' }
);

CoachingInsightSchema.index({ tenantId: 1, employeeId: 1, generatedAt: 1 });
module.exports = mongoose.model('CoachingInsight', CoachingInsightSchema);