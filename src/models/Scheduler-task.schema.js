// scheduler-task.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * General-purpose scheduled tasks (attendance recompute, leave accrual, carry-forward, reminders).
 */
const RunHistorySchema = new Schema(
  {
    runAt: { type: Date, required: true },
    status: { type: String, enum: ['succeeded', 'failed'], required: true },
    durationMs: { type: Number, default: 0 },
    error: { type: String, trim: true },
  },
  { _id: false }
);

const SchedulerTaskSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    cron: { type: String, required: true, trim: true }, // "0 3 * * *"
    timezone: { type: String, default: 'Asia/Kolkata' },

    handlerKey: {
      type: String,
      required: true,
      trim: true,
      // e.g., 'attendance.recompute.daily', 'leave.accrual.monthly', 'payroll.lock.reminder'
    },
    payload: Schema.Types.Mixed,

    active: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },

    runHistory: { type: [RunHistorySchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'scheduler_tasks' }
);

SchedulerTaskSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('SchedulerTask', SchedulerTaskSchema);