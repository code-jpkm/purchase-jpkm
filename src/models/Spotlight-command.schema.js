// spotlight-command.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Natural-language command center for batch operations (e.g., bulk roster assignment).
 */

const ParseResultSchema = new Schema(
  {
    intent: { type: String, required: true }, // assignShift, bulkRoster, policyUpdate, broadcast, etc.
    confidence: { type: Number, default: 0.0 },
    payload: Schema.Types.Mixed, // structured data extracted from text
    errors: [{ type: String }],
  },
  { _id: false }
);

const SpotlightCommandSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    issuerUserId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    rawText: { type: String, required: true, trim: true },
    parse: { type: ParseResultSchema },

    status: { type: String, enum: ['queued', 'processing', 'done', 'failed'], default: 'queued', index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },

    results: Schema.Types.Mixed, // summary counts, affected entities, etc.
    error: { type: String, trim: true },

    auditContext: {
      ip: { type: String, trim: true },
      userAgent: { type: String, trim: true },
    },
  },
  { timestamps: true, versionKey: false, collection: 'spotlight_commands' }
);

SpotlightCommandSchema.index({ tenantId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('SpotlightCommand', SpotlightCommandSchema);