// approval-matrix.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Optional: dynamic approver rules based on conditions (amount, department, designation, etc.).
 * Used by workflows to pick approvers at runtime.
 */
const ConditionSchema = new Schema(
  {
    expr: { type: String, required: true, trim: true }, // DSL evaluated against entity payload/context
  },
  { _id: false }
);

const ApproverSchema = new Schema(
  {
    approverType: { type: String, enum: ['role', 'manager', 'specific-user'], required: true },
    roleId: { type: Types.ObjectId, ref: 'Role' },
    managerLevel: { type: Number, min: 0 },
    userId: { type: Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const ApprovalMatrixSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    entityType: { type: String, required: true }, // 'expense', 'overtime', etc.

    rules: [
      {
        conditions: { type: [ConditionSchema], default: [] },
        approvers: { type: [ApproverSchema], default: [] },
        anyOneCanApprove: { type: Boolean, default: true },
        order: { type: Number, default: 1 },
      },
    ],

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'approval_matrices' }
);

ApprovalMatrixSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ApprovalMatrix', ApprovalMatrixSchema);