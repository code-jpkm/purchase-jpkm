// impersonation-session.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Logs privileged impersonation sessions (e.g., superadmin supporting a user).
 */
const ImpersonationSessionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    adminUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    targetUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date },
    reason: { type: String, trim: true },

    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },

    approvedByUserId: { type: Types.ObjectId, ref: 'User' }, // optional dual control
  },
  { timestamps: true, versionKey: false, collection: 'impersonation_sessions' }
);

ImpersonationSessionSchema.index({ tenantId: 1, adminUserId: 1, startedAt: 1 });

module.exports = mongoose.model('ImpersonationSession', ImpersonationSessionSchema);