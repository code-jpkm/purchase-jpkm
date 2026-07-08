// performance-goal.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const MeasureSchema = new Schema(
  {
    metric: { type: String, required: true, trim: true }, // e.g., "Sales Revenue"
    target: { type: Number, required: true },
    unit: { type: String, trim: true }, // e.g., 'INR', '%'
  },
  { _id: false }
);

const CheckInSchema = new Schema(
  {
    date: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },
    comment: { type: String, trim: true },
    attachmentUrls: { type: [String], default: [] },
    byUserId: { type: Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const PerformanceGoalSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cycleId: { type: Types.ObjectId, ref: 'PerformanceCycle', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    weight: { type: Number, default: 10 }, // total weights across goals can sum to 100
    category: { type: String, trim: true }, // e.g., 'OKR', 'KPI', 'Behavioral'
    measures: { type: [MeasureSchema], default: [] },

    progress: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'active', index: true },

    managerId: { type: Types.ObjectId, ref: 'EmployeeProfile' },
    checkIns: { type: [CheckInSchema], default: [] },

    isLocked: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'performance_goals' }
);

PerformanceGoalSchema.index({ tenantId: 1, cycleId: 1, employeeId: 1 });

module.exports = mongoose.model('PerformanceGoal', PerformanceGoalSchema);