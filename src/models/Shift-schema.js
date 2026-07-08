// shift.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Shift is defined with clock times (24h, local to location/timezone).
 * For night shifts, endTime can be "next day" logically; nightShift = true indicates cross-midnight logic.
 * Times stored as "HH:mm" strings to avoid TZ drift; compute engine uses tenant/location timezone.
 */
const ShiftSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g., A, B, C, G1, NS
    shortLabel: { type: String, trim: true }, // UI label, optional

    startTime: { type: String, required: true, match: /^[0-2]\d:[0-5]\d$/ }, // "HH:mm"
    endTime: { type: String, required: true, match: /^[0-2]\d:[0-5]\d$/ },   // "HH:mm"
    nightShift: { type: Boolean, default: false, index: true }, // cross-midnight if true
    breakMinutes: { type: Number, default: 0, min: 0 },
    minWorkMinutes: { type: Number, default: 0, min: 0 },       // attendance validity minimum

    // Optional shift-level overrides for attendance policy
    policyOverrides: {
      graceRules: [
        {
          thresholdMinutes: { type: Number, required: true, enum: [5, 10, 15, 20, 30, 45, 60] },
          effect: {
            type: String,
            enum: ['none', 'warn', 'half-day', 'lop', 'deduction-component'],
            default: 'warn',
          },
          deductionComponentId: { type: Types.ObjectId, ref: 'PayrollComponent' },
          countTowardsLateQuota: { type: Boolean, default: true },
        },
      ],
      rounding: {
        inRoundingMinutes: { type: Number, default: 1 },
        outRoundingMinutes: { type: Number, default: 1 },
        strategy: { type: String, enum: ['nearest', 'floor', 'ceil'], default: 'nearest' },
      },
      overtime: {
        enabled: { type: Boolean, default: false },
        minMinutes: { type: Number, default: 60 }, // minimum to start counting OT
        roundToMinutes: { type: Number, default: 30 },
        capPerDayMinutes: { type: Number, default: 240 }, // 4h cap default
        requireApproval: { type: Boolean, default: true },
      },
    },

    description: { type: String, trim: true },
    color: { type: String, trim: true }, // UI color tag like "#1e88e5"

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'shifts' }
);

ShiftSchema.index({ tenantId: 1, code: 1 }, { unique: true });
ShiftSchema.index({ tenantId: 1, isActive: 1, nightShift: 1 });

module.exports = mongoose.model('Shift', ShiftSchema);