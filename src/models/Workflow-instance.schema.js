// workflow-instance.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const HistoryEntrySchema = new Schema(
  {
    stepOrder: { type: Number, required: true },
    actorUserId: { type: Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['submit', 'approve', 'reject', 'return', 'delegate', 'auto-approve', 'auto-reject'], required: true },
    comment: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    attachments: { type: [String], default: [] },
  },
  { _id: false }
);

const WorkflowInstanceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    workflowId: { type: Types.ObjectId, ref: 'Workflow', required: true, index: true },
    entityRef: {
      type: {
        type: String,
        required: true,
        // Examples: 'LeaveRequest', 'ExpenseClaim', 'SalaryStructure', etc.
      },
      id: { type: Types.ObjectId, required: true, index: true },
    },

    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    currentStepOrder: { type: Number, default: 1, index: true },
    pendingApproverRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],
    pendingApproverUserIds: [{ type: Types.ObjectId, ref: 'User' }],

    submittedByUserId: { type: Types.ObjectId, ref: 'User', required: true },
    submittedAt: { type: Date, default: Date.now },

    history: { type: [HistoryEntrySchema], default: [] },

    slaBreached: { type: Boolean, default: false, index: true },
    lastEscalationAt: { type: Date },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'workflow_instances' }
);

WorkflowInstanceSchema.index({ tenantId: 1, 'entityRef.type': 1, 'entityRef.id': 1 }, { unique: true });

module.exports = mongoose.model('WorkflowInstance', WorkflowInstanceSchema);