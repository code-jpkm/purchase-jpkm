// roster-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Pattern-based roster template. Apply by department/location or to individuals.
 * dayOffset is 0-based from template startDate reference during application.
 */
const TemplateEntrySchema = new Schema(
  {
    dayOffset: { type: Number, required: true, min: 0 },
    shiftId: { type: Types.ObjectId, ref: 'Shift' },
    off: { type: Boolean, default: false },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const RosterTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    cycleLengthDays: { type: Number, required: true, min: 1 }, // e.g., 7/14/28
    pattern: { type: [TemplateEntrySchema], default: [] },

    defaultWeekOffRuleId: { type: Types.ObjectId, ref: 'WeekOffRule' }, // overlay week-offs when applying
    allowOverrideOnHolidays: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'roster_templates' }
);

RosterTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });
RosterTemplateSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('RosterTemplate', RosterTemplateSchema);