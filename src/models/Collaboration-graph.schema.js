// collaboration-graph.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CollaborationGraphSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    periodKey: { type: String, required: true, trim: true, index: true }, // "2025-05"
    edges: [
      {
        fromEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true },
        toEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true },
        weight: { type: Number, default: 0 }, // frequency/strength
        channels: { type: [String], default: [] }, // email, meetings, tasks
      },
    ],
  },
  { timestamps: true, versionKey: false, collection: 'collaboration_graphs' }
);

CollaborationGraphSchema.index({ tenantId: 1, periodKey: 1 }, { unique: true });
module.exports = mongoose.model('CollaborationGraph', CollaborationGraphSchema);