// department.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DepartmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    parentDepartmentId: { type: Types.ObjectId, ref: 'Department', default: null, index: true },
    headEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },

    // metadata
    tags: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'departments' }
);

DepartmentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Department', DepartmentSchema);