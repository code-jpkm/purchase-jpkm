// employee-dependent.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const EmployeeDependentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    relationship: { type: String, enum: ['spouse', 'child', 'parent', 'domestic-partner', 'other'], required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dob: { type: Date },
    documents: { type: [String], default: [] },

    disabled: { type: Boolean, default: false },
    student: { type: Boolean, default: false },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'employee_dependents' }
);

EmployeeDependentSchema.index({ tenantId: 1, employeeId: 1, relationship: 1, firstName: 1, dob: 1 });

module.exports = mongoose.model('EmployeeDependent', EmployeeDependentSchema);