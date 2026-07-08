// role-permission.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RolePermissionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    roleId: { type: Types.ObjectId, ref: 'Role', required: true, index: true },
    permissionId: { type: Types.ObjectId, ref: 'Permission', required: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'role_permissions' }
);

RolePermissionSchema.index({ tenantId: 1, roleId: 1, permissionId: 1 }, { unique: true });

module.exports = mongoose.model('RolePermission', RolePermissionSchema);