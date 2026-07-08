// pulse-schedule.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PulseScheduleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    surveyId: { type: Types.ObjectId, ref: 'Survey', required: true, index: true },
    cron: { type: String, required: true, trim: true }, // e.g., weekly
    timezone: { type: String, default: 'Asia/Kolkata' },
    active: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'pulse_schedules' }
);

PulseScheduleSchema.index({ tenantId: 1, surveyId: 1, active: 1 });
module.exports = mongoose.model('PulseSchedule', PulseScheduleSchema);