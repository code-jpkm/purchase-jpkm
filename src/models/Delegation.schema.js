// delegation.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Delegation of approval rights from one user to another for a period.
 */
const DelegationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    fromUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    entityTypes: { type: [String], default: ['leave', 'expense', 'timesheet', 'overtime', 'salary-structure', 'roster'] },
    actions: { type: [String], default: ['approve', 'reject', 'return'] },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },

    allowImpersonationView: { type: Boolean, default: false }, // view as principal, read-only
    active: { type: Boolean, default: true, index: true },

    createdByUserId: { type: Types.ObjectId, ref: 'User' },
    reason: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'delegations' }
);

DelegationSchema.index({ tenantId: 1, fromUserId: 1, toUserId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Delegation', DelegationSchema);