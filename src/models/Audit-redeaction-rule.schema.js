// audit-redaction-rule.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Rules to redact/mask sensitive fields in audit logs, exports, APIs for certain roles.
 */
const FieldRuleSchema = new Schema(
  {
    path: { type: String, required: true, trim: true }, // dot path: 'statutoryIds.pan'
    strategy: { type: String, enum: ['mask', 'hash', 'remove'], default: 'mask' },
    maskPattern: { type: String, default: '****{last4}' }, // last4 kept, rest masked
  },
  { _id: false }
);

const AuditRedactionRuleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    entityType: { type: String, required: true, trim: true }, // e.g., 'EmployeeProfile'
    fields: { type: [FieldRuleSchema], default: [] },

    appliesToRoleIds: [{ type: Types.ObjectId, ref: 'Role' }], // rules applied for these roles
    excludesRoleIds: [{ type: Types.ObjectId, ref: 'Role' }], // skip for these roles (admins)

    active: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'audit_redaction_rules' }
);

AuditRedactionRuleSchema.index({ tenantId: 1, entityType: 1, active: 1 });

module.exports = mongoose.model('AuditRedactionRule', AuditRedactionRuleSchema);