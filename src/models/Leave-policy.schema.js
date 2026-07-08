// leave-policy.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Policy controls who is eligible, how accrual happens, carry-forward, encashment, sandwich rules, and approvals.
 * Policies are versioned by effective dates and can be scoped to org segments.
 */

const EligibilitySchema = new Schema(
  {
    minTenureDays: { type: Number, default: 0 },
    maxTenureDays: { type: Number }, // optional
    genders: { type: [String], enum: ['male', 'female', 'other'], default: [] }, // empty = all
    employmentTypes: {
      type: [String],
      enum: ['permanent', 'contract', 'intern', 'part-time'],
      default: ['permanent', 'contract', 'intern', 'part-time'],
    },
    locations: [{ type: Types.ObjectId, ref: 'Location' }],
    departments: [{ type: Types.ObjectId, ref: 'Department' }],
    designations: [{ type: Types.ObjectId, ref: 'Designation' }],
    excludeEmployees: [{ type: Types.ObjectId, ref: 'EmployeeProfile' }],
    includeEmployees: [{ type: Types.ObjectId, ref: 'EmployeeProfile' }],
  },
  { _id: false }
);

const AccrualSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    frequency: { type: String, enum: ['daily', 'monthly', 'quarterly', 'annual', 'on-join'], default: 'monthly' },
    // Amount per frequency in units (days/hours)
    amountPerCycle: { type: Number, default: 1.5 }, // e.g., 1.5 days per month
    prorateOnJoin: { type: Boolean, default: true },
    prorateOnExit: { type: Boolean, default: true },
    creditTiming: { type: String, enum: ['start-of-period', 'end-of-period', 'on-schedule'], default: 'start-of-period' },
    rounding: { type: String, enum: ['none', 'nearest-0.5', 'nearest-0.25', 'floor-0.5', 'floor-0.25'], default: 'none' },
    maxAnnualAccrual: { type: Number }, // optional cap per year
  },
  { _id: false }
);

const CarryForwardSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    maxCarryUnits: { type: Number, default: 30 }, // e.g., 30 days
    carryForwardPercent: { type: Number, default: 100 }, // instead of fixed units, optional
    expiresAfterMonths: { type: Number, default: 12 }, // 0 = never expires
    applyAtYearEnd: { type: Boolean, default: true },
    lossAs: { type: String, enum: ['lapse', 'encash', 'convert-lop'], default: 'lapse' },
  },
  { _id: false }
);

const EncashmentSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    minBalanceToEncash: { type: Number, default: 0 },
    maxEncashUnitsPerYear: { type: Number, default: 0 },
    valuationMethod: {
      type: String,
      enum: ['basic-percent', 'ctc-percent', 'fixed-per-day', 'per-day-based-on-payroll-component'],
      default: 'basic-percent',
    },
    valuationPercent: { type: Number, default: 100 },
    perDayRateFixed: { type: Number }, // if fixed-per-day
    payrollComponentId: { type: Types.ObjectId, ref: 'PayrollComponent' }, // if derive per-day from component
    taxable: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true },
  },
  { _id: false }
);

const SandwichRuleSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    scope: { type: String, enum: ['weekends-only', 'holidays-only', 'both'], default: 'both' },
    countBridgingDaysAsLeave: { type: Boolean, default: true }, // if true, bridge days become leave
    exemptIfApprovedWorkOnBridge: { type: Boolean, default: true },
    excludeRestrictedHolidays: { type: Boolean, default: false },
  },
  { _id: false }
);

const BlackoutSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    windows: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        maxConcurrentLeaves: { type: Number }, // optional limit
        departmentId: { type: Types.ObjectId, ref: 'Department' }, // optional scoping
        locationId: { type: Types.ObjectId, ref: 'Location' },
      },
    ],
  },
  { _id: false }
);

const ApprovalSchema = new Schema(
  {
    workflowId: { type: Types.ObjectId, ref: 'Workflow' }, // falls back to default workflow if absent
    autoApproveIfBalanceSufficient: { type: Boolean, default: false },
    allowBackdatedRequestDays: { type: Number, default: 0 }, // e.g., allow backdated by X days
    allowFutureDatedRequestDays: { type: Number, default: 365 },
  },
  { _id: false }
);

const LeavePolicySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    leaveTypeId: { type: Types.ObjectId, ref: 'LeaveType', required: true, index: true },

    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date }, // null=open-ended

    eligibility: { type: EligibilitySchema, default: {} },
    accrual: { type: AccrualSchema, default: {} },
    carryForward: { type: CarryForwardSchema, default: {} },
    encashment: { type: EncashmentSchema, default: {} },

    bookingRules: {
      minNoticeDays: { type: Number, default: 0 },
      maxAdvanceBookingDays: { type: Number, default: 365 },
      minDuration: { type: Number, default: 0.5 }, // days or hours depending on unit
      maxDurationPerRequest: { type: Number, default: 30 },
      allowHalfDay: { type: Boolean, default: true },
      allowHourly: { type: Boolean, default: false },
      requireReason: { type: Boolean, default: true },
      requireAttachmentIfMoreThanDays: { type: Number, default: 0 },
    },

    sandwich: { type: SandwichRuleSchema, default: {} },
    blackout: { type: BlackoutSchema, default: {} },
    approvals: { type: ApprovalSchema, default: {} },

    // LOP and balance shortfall handling
    shortfallHandling: {
      allowNegativeBalance: { type: Boolean, default: false },
      convertExcessToLOP: { type: Boolean, default: true },
      lopPayrollComponentId: { type: Types.ObjectId, ref: 'PayrollComponent' },
    },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'leave_policies' }
);

LeavePolicySchema.index({ tenantId: 1, code: 1 }, { unique: true });
LeavePolicySchema.index({ tenantId: 1, leaveTypeId: 1, effectiveFrom: 1 });

module.exports = mongoose.model('LeavePolicy', LeavePolicySchema);