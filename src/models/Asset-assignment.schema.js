// asset-assignment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AssetAssignmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    assetId: { type: Types.ObjectId, ref: 'Asset', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    assignedAt: { type: Date, required: true, default: Date.now },
    expectedReturnAt: { type: Date },
    returnedAt: { type: Date },

    conditionOnIssue: { type: String, trim: true },
    conditionOnReturn: { type: String, trim: true },
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['active', 'returned', 'lost', 'damaged'], default: 'active', index: true },

    depositCollected: { type: Number, default: 0 },
    recoveryComponentId: { type: Types.ObjectId, ref: 'PayrollComponent' }, // recovery if lost/damaged

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
  },
  { timestamps: true, versionKey: false, collection: 'asset_assignments' }
);

AssetAssignmentSchema.index({ tenantId: 1, assetId: 1, status: 1 });

module.exports = mongoose.model('AssetAssignment', AssetAssignmentSchema);