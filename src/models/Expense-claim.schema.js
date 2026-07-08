// expense-claim.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ExpenseItemSchema = new Schema(
  {
    categoryId: { type: Types.ObjectId, ref: 'ExpenseCategory', required: true },
    description: { type: String, trim: true },
    amount: { type: Number, required: true },
    billDate: { type: Date, required: true },
    merchant: { type: String, trim: true },
    taxAmount: { type: Number, default: 0 }, // GST/VAT if relevant
    attachments: { type: [String], default: [] },
    mileageKm: { type: Number, default: 0 },
    projectCode: { type: String, trim: true },
  },
  { _id: false }
);

const ExpenseClaimSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    claimNumber: { type: String, required: true, trim: true, index: true },

    items: { type: [ExpenseItemSchema], default: [] },
    totalAmount: { type: Number, required: true, default: 0 },

    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled'], default: 'submitted', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    processedViaPayroll: { type: Boolean, default: false },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod' },
    payslipId: { type: Types.ObjectId, ref: 'Payslip' },

    paidAt: { type: Date },
    payoutReference: { type: String, trim: true },

    notes: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'expense_claims' }
);

ExpenseClaimSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

module.exports = mongoose.model('ExpenseClaim', ExpenseClaimSchema);