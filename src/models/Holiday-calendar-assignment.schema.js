// holiday-calendar-assignment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const HolidayCalendarAssignmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    calendarId: { type: Types.ObjectId, ref: 'HolidayCalendar', required: true, index: true },

    scopeType: {
      type: String,
      required: true,
      enum: ['company', 'location', 'department', 'employee'],
      index: true,
    },
    scopeId: { type: Types.ObjectId, index: true }, // null for company scope

    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date }, // null = open-ended

    isPrimary: { type: Boolean, default: true }, // primary vs. additional calendars (if allowed)
    isActive: { type: Boolean, default: true, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'holiday_calendar_assignments' }
);

// Enforce one primary assignment per scope at a time (soft-constraint; overlaps require app logic checks)
HolidayCalendarAssignmentSchema.index(
  { tenantId: 1, scopeType: 1, scopeId: 1, isPrimary: 1, isActive: 1 }
);

module.exports = mongoose.model('HolidayCalendarAssignment', HolidayCalendarAssignmentSchema);