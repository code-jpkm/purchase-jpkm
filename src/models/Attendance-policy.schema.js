// attendance-policy.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Policy is versioned by effectiveFrom/To. Attach policy to employees via Settings or scoped assignment.
 */
const GraceRuleSchema = new Schema(
  {
    thresholdMinutes: { type: Number, required: true, enum: [5,10,15,20,30,45,60] },
    effect: {
      type: String,
      enum: ['none', 'warn', 'half-day', 'lop', 'deduction-component'],
      default: 'warn',
    },
    deductionComponentId: { type: Types.ObjectId, ref: 'PayrollComponent' },
    perMonthQuota: { type: Number, default: 0 }, // allowed lates at this tier before effect escalates
    resetCycle: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
  },
  { _id: false }
);

const RoundingRuleSchema = new Schema(
  {
    inRoundingMinutes: { type: Number, default: 1 },
    outRoundingMinutes: { type: Number, default: 1 },
    strategy: { type: String, enum: ['nearest', 'floor', 'ceil'], default: 'nearest' },
  },
  { _id: false }
);

const OvertimeRuleSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    minMinutes: { type: Number, default: 60 },
    roundToMinutes: { type: Number, default: 30 },
    capPerDayMinutes: { type: Number, default: 240 },
    premiumMultiplier: { type: Number, default: 1.0 }, // multiplier on hourly rate
    requireApproval: { type: Boolean, default: true },
  },
  { _id: false }
);

const PairingRuleSchema = new Schema(
  {
    requirePairs: { type: Boolean, default: true }, // require in/out pairs to count a day
    maxGapMinutes: { type: Number, default: 720 }, // max gap between in and out to pair (12h)
    allowSinglePunchPresent: { type: Boolean, default: false }, // count as present with minMinutes?
  },
  { _id: false }
);

const HolidayWeekoffInteractionSchema = new Schema(
  {
    holidayOverridesShift: { type: Boolean, default: true }, // if holiday, ignore shift
    weekOffOverridesShift: { type: Boolean, default: true },
    holidayPaid: { type: Boolean, default: true },
    weekOffPaid: { type: Boolean, default: false },
    workOnHolidayOT: { type: Boolean, default: true }, // OT if worked on holiday
    workOnWeekOffOT: { type: Boolean, default: true },
  },
  { _id: false }
);

const AttendancePolicySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date }, // null open-ended

    daily: {
      standardWorkMinutes: { type: Number, default: 480 }, // 8h
      minWorkMinutesForPresent: { type: Number, default: 240 }, // half-day threshold
      halfDayMinutes: { type: Number, default: 240 },
      lateGraceRules: { type: [GraceRuleSchema], default: [] }, // include 15/30 min tiers etc.
      earlyLeaveGraceMinutes: { type: Number, default: 0 },
      rounding: { type: RoundingRuleSchema, default: {} },
      pairing: { type: PairingRuleSchema, default: {} },
      overtime: { type: OvertimeRuleSchema, default: {} },
      nightShiftWindowMinutes: { type: Number, default: 120 }, // tolerance for cross-midnight pairing
    },

    monthly: {
      maxLateCountBeforeLOP: { type: Number, default: 3 },
      lateToHalfDayAfterCount: { type: Number, default: 6 },
      maxConsecutiveAbsentsAlert: { type: Number, default: 3 },
    },

    scopes: {
      // optional scoping for automatic assignment
      locations: [{ type: Types.ObjectId, ref: 'Location' }],
      departments: [{ type: Types.ObjectId, ref: 'Department' }],
      designations: [{ type: Types.ObjectId, ref: 'Designation' }],
    },

    holidayWeekoffInteraction: { type: HolidayWeekoffInteractionSchema, default: {} },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'attendance_policies' }
);

AttendancePolicySchema.index({ tenantId: 1, code: 1 }, { unique: true });
AttendancePolicySchema.index({ tenantId: 1, isActive: 1, effectiveFrom: 1 });

module.exports = mongoose.model('AttendancePolicy', AttendancePolicySchema);