// audit-log.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Immutable audit logs for all sensitive operations.
 * Never soft-delete. Use separate archive process if needed.
 */
const AuditLogSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    actorUserId: { type: Types.ObjectId, ref: 'User' },
    actorRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],

    action: { type: String, required: true, trim: true }, // e.g., 'leave.request.create'
    entityType: { type: String, trim: true }, // 'LeaveRequest'
    entityId: { type: Types.ObjectId }, // target entity id

    path: { type: String, trim: true }, // API route/UI path
    method: { type: String, trim: true }, // HTTP method if applicable
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },

    before: Schema.Types.Mixed, // redacted data where needed
    after: Schema.Types.Mixed,

    at: { type: Date, default: Date.now, index: true },
    meta: Schema.Types.Mixed,
  },
  { versionKey: false, collection: 'audit_logs' }
);

AuditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, at: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);