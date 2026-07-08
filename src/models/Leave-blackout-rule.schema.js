// leave-blackout-rule.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Optional: additional blackout windows across leave types by scope.
 * You can also rely on policy.blackout; this provides central control across types.
 */
const ScopeSchema = new Schema(
  {
    scopeType: { type: String, enum: ['company', 'location', 'department'], required: true },
    scopeId: { type: Types.ObjectId }, // null for company
  },
  { _id: false }
);

const LeaveBlackoutRuleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    leaveTypeIds: [{ type: Types.ObjectId, ref: 'LeaveType' }], // empty = all leave types
    scopes: { type: [ScopeSchema], default: [] },

    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    maxConcurrentLeaves: { type: Number }, // optional limit

    overridePolicyBlackout: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_blackout_rules' }
);

LeaveBlackoutRuleSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBlackoutRule', LeaveBlackoutRuleSchema);