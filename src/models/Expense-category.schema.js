// expense-category.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ExpenseCategorySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    policy: {
      perDayLimit: { type: Number, default: 0 },
      perMonthLimit: { type: Number, default: 0 },
      requireReceipt: { type: Boolean, default: true },
      taxable: { type: Boolean, default: false },
      mileageRatePerKm: { type: Number, default: 0 }, // for mileage category
    },

    payrollComponentId: { type: Types.ObjectId, ref: 'PayrollComponent' }, // if processed via payroll

    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'expense_categories' }
);

ExpenseCategorySchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ExpenseCategory', ExpenseCategorySchema);