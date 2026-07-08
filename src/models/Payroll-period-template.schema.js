// payroll-period-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Defines recurring payroll cycles (e.g., Monthly 1–30, payout on last working day).
 */
const PayrollPeriodTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    frequency: { type: String, enum: ['monthly'], default: 'monthly' },
    startDay: { type: Number, min: 1, max: 28, default: 1 }, // 1 = first day
    endDay: { type: Number, min: 1, max: 31, default: 30 },  // 30 default
    payoutDayStrategy: { type: String, enum: ['last-working-day', 'fixed-day'], default: 'last-working-day' },
    payoutFixedDay: { type: Number, min: 1, max: 31 },

    inputCutoffDaysBeforeEnd: { type: Number, default: 2 },
    lockOnPayoutDay: { type: Boolean, default: true },

    timezone: { type: String, default: 'Asia/Kolkata' },

    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'payroll_period_templates' }
);

PayrollPeriodTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('PayrollPeriodTemplate', PayrollPeriodTemplateSchema);