         // payroll-period.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PayrollPeriodSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    templateId: { type: Types.ObjectId, ref: 'PayrollPeriodTemplate', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., "Apr 2025"
    periodKey: { type: String, required: true, trim: true, index: true }, // e.g., "2025-04"

    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    payoutDate: { type: Date, index: true },

    status: { type: String, enum: ['open', 'processing', 'processed', 'closed'], default: 'open', index: true },
    inputLocked: { type: Boolean, default: false, index: true },
    payrollLocked: { type: Boolean, default: false, index: true },

    createdByUserId: { type: Types.ObjectId, ref: 'User' },
    closedByUserId: { type: Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },

    notes: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false, collection: 'payroll_periods' }
);

PayrollPeriodSchema.index({ tenantId: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model('PayrollPeriod', PayrollPeriodSchema);