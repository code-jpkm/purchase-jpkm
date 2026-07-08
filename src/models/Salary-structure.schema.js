// salary-structure.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const StructureComponentSchema = new Schema(
  {
    componentId: { type: Types.ObjectId, ref: 'PayrollComponent', required: true },
    calcType: { type: String, enum: ['fixed', 'percent', 'formula', 'input'], required: true },
    amount: { type: Number }, // for fixed
    percentRate: { type: Number }, // for percent
    baseComponents: [{ type: Types.ObjectId, ref: 'PayrollComponent' }],
    formula: { type: String, trim: true },
    capPerMonth: { type: Number },
    floorPerMonth: { type: Number },
    includeInCTC: { type: Boolean, default: true },
  },
  { _id: false }
);

const SalaryStructureSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    grade: { type: String, trim: true }, // optional band/grade
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date }, // null = active

    currency: { type: String, default: 'INR' },
    components: { type: [StructureComponentSchema], default: [] },
    monthlyCTC: { type: Number, default: 0 },
    annualCTC: { type: Number, default: 0 },

    approved: { type: Boolean, default: false, index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
    approvedAt: { type: Date },
    approvedByUserId: { type: Types.ObjectId, ref: 'User' },

    notes: { type: String, trim: true },
    locked: { type: Boolean, default: false, index: true }, // prevents edits once payroll processed on it

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'salary_structures' }
);

SalaryStructureSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: 1 }, { unique: true });

module.exports = mongoose.model('SalaryStructure', SalaryStructureSchema);