// role-assignment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RoleAssignmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    roleId: { type: Types.ObjectId, ref: 'Role', required: true, index: true },
    // Optional scoping: a manager can be scoped to a department or location
    scope: {
      departmentId: { type: Types.ObjectId, ref: 'Department' },
      locationId: { type: Types.ObjectId, ref: 'Location' },
      costCenterId: { type: Types.ObjectId, ref: 'CostCenter' },
    },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, collection: 'role_assignments' }
);

RoleAssignmentSchema.index({ tenantId: 1, userId: 1, roleId: 1, 'scope.departmentId': 1, 'scope.locationId': 1 }, { unique: true });

module.exports = mongoose.model('RoleAssignment', RoleAssignmentSchema);