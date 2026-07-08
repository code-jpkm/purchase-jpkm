// separation.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ClearanceItemSchema = new Schema(
  {
    area: { type: String, trim: true }, // e.g., 'IT Assets', 'Finance', 'Admin'
    status: { type: String, enum: ['pending', 'cleared', 'waived'], default: 'pending' },
    remarks: { type: String, trim: true },
    clearedAt: { type: Date },
    clearedByUserId: { type: Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const FnFDetailSchema = new Schema(
  {
    lastWorkingDate: { type: Date },
    payableDays: { type: Number, default: 0 },
    encashLeaveUnits: { type: Number, default: 0 },
    encashAmount: { type: Number, default: 0 },
    recoveryAmount: { type: Number, default: 0 },
    gratuityAmount: { type: Number, default: 0 },
    bonusAmount: { type: Number, default: 0 },
    otherAdjustments: { type: Number, default: 0 },
    totalPayable: { type: Number, default: 0 },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod' },
    payslipId: { type: Types.ObjectId, ref: 'Payslip' },
  },
  { _id: false }
);

const SeparationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    resignationDate: { type: Date, required: true, index: true },
    noticePeriodDays: { type: Number, default: 0 },
    expectedLastWorkingDate: { type: Date },
    lastWorkingDate: { type: Date },

    reasonCategory: { type: String, trim: true }, // 'job change', 'personal', 'termination'
    reasonDetail: { type: String, trim: true },

    status: { type: String, enum: ['initiated', 'in-clearance', 'fnf-processing', 'completed', 'cancelled'], default: 'initiated', index: true },

    clearance: { type: [ClearanceItemSchema], default: [] },
    fnf: { type: FnFDetailSchema, default: {} },

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'separations' }
);

SeparationSchema.index({ tenantId: 1, employeeId: 1, resignationDate: 1 });

module.exports = mongoose.model('Separation', SeparationSchema);