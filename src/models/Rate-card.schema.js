 // rate-card.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RateLineSchema = new Schema(
  {
    taskId: { type: Types.ObjectId, ref: 'ProjectTask' },
    hourlyRate: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
  },
  { _id: false }
);

const RateCardSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    projectId: { type: Types.ObjectId, ref: 'Project' }, // optional project-specific
    defaultHourlyRate: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },

    lines: { type: [RateLineSchema], default: [] },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'rate_cards' }
);

RateCardSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('RateCard', RateCardSchema);