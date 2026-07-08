// role.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RoleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ['superadmin', 'admin', 'director', 'manager', 'hod', 'incharge', 'supervisor', 'labor'],
      index: true,
    },
    name: { type: String, required: true, trim: true }, // display name (can be customized per tenant)
    description: { type: String, trim: true },
    isSystem: { type: Boolean, default: false }, // protect base roles
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'roles' }
);

RoleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Role', RoleSchema);