// leave-type.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Base definition of a leave category. Per-tenant unique code.
 * Policy rules (accrual, carry-forward, encashment, sandwich) live in LeavePolicy.
 */
const LeaveTypeSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    leaveClass: {
      type: String,
      enum: ['earned', 'casual', 'sick', 'maternity', 'paternity', 'comp-off', 'unpaid', 'special', 'other'],
      default: 'other',
      index: true,
    },
    unit: { type: String, enum: ['days', 'hours'], default: 'days' },
    decimalPrecision: { type: Number, enum: [0, 1, 2], default: 1 }, // rounding precision

    requiresDocumentIfMoreThanDays: { type: Number, default: 0 }, // 0=no requirement
    doctorNoteRequiredForSickIfMoreThanDays: { type: Number, default: 0 },

    allowHalfDay: { type: Boolean, default: true },
    allowHourly: { type: Boolean, default: false }, // if true, segments in hours
    minUnit: { type: Number, default: 0.5 }, // min booking unit (days or hours)

    isEncashable: { type: Boolean, default: false },
    isCarryForwardEligible: { type: Boolean, default: true },

    maxBalanceCap: { type: Number, default: 365 }, // safety cap
    negativeBalanceAllowed: { type: Boolean, default: false }, // request can exceed balance?
    overlapWithOtherTypesAllowed: { type: Boolean, default: false },

    genderEligibility: { type: [String], enum: ['male', 'female', 'other'], default: [] }, // empty = all
    employmentTypes: {
      type: [String],
      enum: ['permanent', 'contract', 'intern', 'part-time'],
      default: ['permanent', 'contract', 'intern', 'part-time'],
    },

    color: { type: String, trim: true }, // UI color tag
    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_types' }
);

LeaveTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LeaveTypeSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('LeaveType', LeaveTypeSchema);