// interview-schedule.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PanelistSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    role: { type: String, trim: true }, // 'Interviewer', 'Observer'
  },
  { _id: false }
);

const InterviewScheduleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    applicationId: { type: Types.ObjectId, ref: 'Application', required: true, index: true },
    templateId: { type: Types.ObjectId, ref: 'InterviewTemplate' },

    stageName: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    mode: { type: String, enum: ['in-person', 'virtual', 'phone'], default: 'virtual' },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },

    panel: { type: [PanelistSchema], default: [] },

    status: { type: String, enum: ['scheduled', 'completed', 'no-show', 'cancelled'], default: 'scheduled', index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'interview_schedules' }
);

InterviewScheduleSchema.index({ tenantId: 1, applicationId: 1, startAt: 1 });

module.exports = mongoose.model('InterviewSchedule', InterviewScheduleSchema);