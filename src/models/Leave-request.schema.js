// leave-request.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Segment-based request supports full/half/hours per date.
 * Sandwich and blackout validation handled by service; result flags stored for audit.
 */

const SegmentSchema = new Schema(
  {
    date: { type: Date, required: true }, // local date start
    portion: { type: String, enum: ['full', 'first-half', 'second-half', 'hours'], default: 'full' },
    hours: { type: Number }, // only if portion='hours'
  },
  { _id: false }
);

const LeaveRequestSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    leaveTypeId: { type: Types.ObjectId, ref: 'LeaveType', required: true, index: true },
    policyId: { type: Types.ObjectId, ref: 'LeavePolicy', required: true },

    fromDate: { type: Date, required: true, index: true },
    toDate: { type: Date, required: true, index: true },
    segments: { type: [SegmentSchema], default: [] },
    totalUnits: { type: Number, required: true }, // computed at submission

    reason: { type: String, trim: true },
    attachmentUrls: { type: [String], default: [] },

    substituteEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile' }, // optional handover
    contactDuringLeave: { type: String, trim: true },

    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    appliedByUserId: { type: Types.ObjectId, ref: 'User', required: true },
    decidedByUserId: { type: Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    decisionComment: { type: String, trim: true },

    sandwichApplied: { type: Boolean, default: false },
    sandwichBridgeDays: { type: Number, default: 0 },
    blackoutViolation: { type: Boolean, default: false },

    balancePeriodKey: { type: String, required: true, trim: true }, // link to LeaveBalance period
    balanceSnapshotBefore: { type: Number }, // capture at submission
    balanceSnapshotAfter: { type: Number },  // capture at approval

    // For cancellation/revisions
    supersedesRequestId: { type: Types.ObjectId, ref: 'LeaveRequest' },
    supersededByRequestId: { type: Types.ObjectId, ref: 'LeaveRequest' },

    // Locking after payroll
    locked: { type: Boolean, default: false, index: true },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod' },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_requests' }
);

LeaveRequestSchema.index({ tenantId: 1, employeeId: 1, fromDate: 1, toDate: 1 });
LeaveRequestSchema.index({ tenantId: 1, status: 1, fromDate: 1 });
LeaveRequestSchema.index({ tenantId: 1, payrollPeriodId: 1, locked: 1 });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);