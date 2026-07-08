const mongoose = require('mongoose');
const { Schema } = mongoose;

const BudgetLineSchema = new Schema(
  {
    slNo: { type: Number },
    foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    department: { type: String, required: true },
    skuCode: { type: String },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem' },
    itemName: { type: String, required: true },
    itemType: { type: String, default: 'Stores' },
    motherItem: { type: String },
    uom: { type: String, required: true },
    consumptionPerKgPerMonth: { type: Number, default: 0 },
    estimatedCastingQty: { type: Number, default: 0 },
    dailyAvgConsumption: { type: Number, default: 0 },
    tentativeOpeningStock: { type: Number, default: 0 },
    avgMonthlyRequirement: { type: Number, default: 0 }, // last 3 months avg
    requiredQtyForMonth: { type: Number, default: 0 },
    minimumOrderQty: { type: Number, default: 0 },
    finalOrderQty: { type: Number, default: 0 },
    rateAsPerLastPurchase: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },

    // Split: 1-15 days
    firstHalfQty: { type: Number, default: 0 },
    firstHalfValue: { type: Number, default: 0 },

    // Split: 16-end days
    secondHalfQty: { type: Number, default: 0 },
    secondHalfValue: { type: Number, default: 0 },

    // Actual spend tracking
    actualQtyPurchased: { type: Number, default: 0 },
    actualValueSpent: { type: Number, default: 0 },
    previousMonthQty: { type: Number, default: 0 },
    previousMonthValue: { type: Number, default: 0 },
    monthOnMonthVariancePercent: { type: Number, default: 0 },
    varianceQty: { type: Number, default: 0 },
    varianceValue: { type: Number, default: 0 },
    variancePercent: { type: Number, default: 0 },
    alertSent: { type: Boolean, default: false },
    alertSentAt: { type: Date },
    budgetStatus: {
      type: String,
      enum: ['Within Budget', 'Over Budget', 'Under Budget', 'Alert Sent'],
      default: 'Within Budget',
    },
  },
  { _id: false }
);

const BudgetSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    monthLabel: { type: String }, // e.g. "December-2025"
    foundry: { type: String, enum: ['D. I', 'C. I'], required: true, index: true },
    department: { type: String, required: true, trim: true, index: true },
    departmentHeadUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    departmentHeadName: { type: String },
    departmentHeadEmail: { type: String },
    departmentHeadWhatsapp: { type: String },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalWorkingDays: { type: Number, default: 27 },

    // Split dates
    firstHalfDays: { type: Number, default: 13 },
    secondHalfDays: { type: Number, default: 14 },

    lines: [BudgetLineSchema],

    totalBudgetValue: { type: Number, default: 0 },
    totalActualValue: { type: Number, default: 0 },
    totalPreviousMonthValue: { type: Number, default: 0 },
    highVsPreviousMonth: { type: Boolean, default: false },
    highVsPreviousMonthPercent: { type: Number, default: 0 },
    adminRemarks: { type: String },

    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Locked'],
      default: 'Draft',
      index: true,
    },
  },
  { timestamps: true, versionKey: false, collection: 'budgets' }
);

BudgetSchema.index({ tenantId: 1, year: 1, month: 1, foundry: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
