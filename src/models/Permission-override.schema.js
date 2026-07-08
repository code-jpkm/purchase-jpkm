// permission-override.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Field-level permission overrides per role and entity.
 */
const FieldPermissionSchema = new Schema(
  {
    path: { type: String, required: true, trim: true }, // e.g., 'bankDetails', 'salaryStructures'
    read: { type: Boolean, default: true },
    write: { type: Boolean, default: false },
    mask: { type: String, enum: ['none', 'partial', 'full'], default: 'none' },
  },
  { _id: false }
);

const PermissionOverrideSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    roleId: { type: Types.ObjectId, ref: 'Role', required: true, index: true },
    entityType: { type: String, required: true, trim: true }, // 'EmployeeProfile', 'Payslip', etc.

    operations: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: true },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },

    fieldPermissions: { type: [FieldPermissionSchema], default: [] },

    conditionExpr: { type: String, trim: true }, // optional expression to limit scope (department == X)
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'permission_overrides' }
);

PermissionOverrideSchema.index({ tenantId: 1, roleId: 1, entityType: 1 }, { unique: true });

module.exports = mongoose.model('PermissionOverride', PermissionOverrideSchema);