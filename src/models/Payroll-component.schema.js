// payroll-component.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Master list of payroll components (earnings/deductions/reimbursements).
 * Supports formula-based calculations and statutory mappings (PF/ESI/PT/TDS).
 */
const PayrollComponentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    kind: { type: String, enum: ['earning', 'deduction', 'reimbursement', 'employer-contribution'], required: true, index: true },
    category: {
      type: String,
      enum: [
        'basic', 'hra', 'da', 'lta', 'special', 'bonus', 'overtime', 'incentive', 'arrear', 'gratuity',
        'pf-employee', 'pf-employer', 'esi-employee', 'esi-employer', 'pt', 'tds', 'lwf', 'lop',
        'reimbursement-generic', 'reimbursement-mileage', 'other'
      ],
      default: 'other',
      index: true,
    },

    calcType: { type: String, enum: ['fixed', 'percent', 'formula', 'input'], default: 'fixed' },
    amountDefault: { type: Number, default: 0 },           // for fixed
    percentOfComponents: [{ type: Types.ObjectId, ref: 'PayrollComponent' }], // for percent
    percentRate: { type: Number },                          // e.g., 40 = 40%
    formula: { type: String, trim: true },                 // DSL/expression evaluated at runtime
    rounding: { type: String, enum: ['none', 'nearest-1', 'nearest-0.5', 'floor-1', 'ceil-1'], default: 'none' },

    frequency: { type: String, enum: ['monthly', 'quarterly', 'annual', 'one-time'], default: 'monthly' },
    isRecurring: { type: Boolean, default: true },

    proRata: {
      enabled: { type: Boolean, default: true },
      basis: { type: String, enum: ['calendar-days', 'working-days', 'attendance-minutes'], default: 'calendar-days' },
      minDaysThreshold: { type: Number, default: 0 },
    },

    taxability: {
      type: String,
      enum: ['taxable', 'exempt', 'partially-exempt', 'not-applicable'],
      default: 'taxable',
    },
    exemptionRule: {
      code: { type: String, trim: true }, // e.g., HRA, LTA specifics handled in tax engine
      maxAnnualExemption: { type: Number },
    },

    statutoryMap: {
      pfWageEligible: { type: Boolean, default: false },
      esiWageEligible: { type: Boolean, default: false },
      ptEligible: { type: Boolean, default: false },
      includeInGratuityBase: { type: Boolean, default: false },
    },

    visibleOnPayslip: { type: Boolean, default: true },
    sequence: { type: Number, default: 100, index: true }, // display/order precedence

    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'payroll_components' }
);

PayrollComponentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
PayrollComponentSchema.index({ tenantId: 1, active: 1, category: 1 });

module.exports = mongoose.model('PayrollComponent', PayrollComponentSchema);