// holiday-calendar.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const HolidayEntrySchema = new Schema(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['public', 'restricted', 'company', 'ad-hoc'], default: 'company', index: true },
    isPaid: { type: Boolean, default: true },
    halfDay: { type: Boolean, default: false },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const HolidayCalendarSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    year: { type: Number, required: true, index: true }, // set per year; copy forward annually
    isRecurringAnnual: { type: Boolean, default: false }, // if true, ignore year and apply annually by month/day

    holidays: { type: [HolidayEntrySchema], default: [] },

    observancePolicy: {
      // if holiday lands on weekend, how to observe
      shiftToWeekday: { type: Boolean, default: false },
      nextBusinessDay: { type: Boolean, default: false },
    },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'holiday_calendars' }
);

HolidayCalendarSchema.index({ tenantId: 1, code: 1, year: 1 }, { unique: true });
HolidayCalendarSchema.index({ tenantId: 1, name: 1, year: 1 });

module.exports = mongoose.model('HolidayCalendar', HolidayCalendarSchema);