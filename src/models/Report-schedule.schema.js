// report-schedule.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ReportScheduleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    reportId: { type: Types.ObjectId, ref: 'ReportDefinition', required: true, index: true },
    name: { type: String, required: true, trim: true },
    cron: { type: String, required: true, trim: true }, // e.g., "0 8 * * 1" (every Mon 8am)
    timezone: { type: String, default: 'Asia/Kolkata' },

    recipients: {
      toUserIds: [{ type: Types.ObjectId, ref: 'User' }],
      toEmails: [{ type: String, trim: true }],
    },

    format: { type: String, enum: ['csv', 'xlsx', 'pdf'], default: 'xlsx' },
    active: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date },
    lastResultUrl: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'report_schedules' }
);

ReportScheduleSchema.index({ tenantId: 1, reportId: 1, active: 1 });

module.exports = mongoose.model('ReportSchedule', ReportScheduleSchema);