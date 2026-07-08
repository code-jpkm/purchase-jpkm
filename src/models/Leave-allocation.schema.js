// leave-allocation.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Manual allocation or deduction entries (grants/adjustments), approvable.
 */
const LeaveAllocationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    leaveTypeId: { type: Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    policyId: { type: Types.ObjectId, ref: 'LeavePolicy', required: true },

    periodKey: { type: String, required: true, trim: true },

    units: { type: Number, required: true }, // +ve=credit, -ve=debit
    reason: { type: String, trim: true },
    attachmentUrls: { type: [String], default: [] },

    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    requestedByUserId: { type: Types.ObjectId, ref: 'User', required: true },
    decidedByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },

    // Immutable when approved; otherwise edits create new record or maintain audit via updates
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_allocations' }
);

LeaveAllocationSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

module.exports = mongoose.model('LeaveAllocation', LeaveAllocationSchema);