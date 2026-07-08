// permission.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PermissionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: { type: String, required: true, trim: true, lowercase: true }, // e.g., 'attendance.view', 'payroll.process'
    description: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'permissions' }
);

PermissionSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Permission', PermissionSchema);