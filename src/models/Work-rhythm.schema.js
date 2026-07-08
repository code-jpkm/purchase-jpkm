// work-rhythm.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const WorkRhythmSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    focusBlocks: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun
        startLocal: { type: String, required: true }, // "09:00"
        endLocal: { type: String, required: true },   // "11:00"
      },
    ],
    meetingPreferences: {
      allowedDays: [{ type: Number, min: 0, max: 6 }],
      allowedStartLocal: { type: String, trim: true },
      allowedEndLocal: { type: String, trim: true },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'work_rhythms' }
);

WorkRhythmSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
module.exports = mongoose.model('WorkRhythm', WorkRhythmSchema);