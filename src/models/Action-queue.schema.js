// action-queue.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Durable queue for executing fine-grained actions derived from Spotlight or system jobs.
 */

const ActionQueueSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    commandId: { type: Types.ObjectId, ref: 'SpotlightCommand', index: true },
    actionType: {
      type: String,
      required: true,
      // examples: 'roster.assign', 'policy.apply', 'notify.broadcast', 'recompute.attendance'
    },
    payload: Schema.Types.Mixed, // minimal data to perform action

    priority: { type: Number, default: 100, index: true },
    status: { type: String, enum: ['queued', 'running', 'succeeded', 'failed'], default: 'queued', index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, index: true },

    error: { type: String, trim: true },
    processedAt: { type: Date },
    workerId: { type: String, trim: true }, // for tracing worker assignments
  },
  { timestamps: true, versionKey: false, collection: 'action_queue' }
);

ActionQueueSchema.index({ tenantId: 1, status: 1, priority: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('ActionQueue', ActionQueueSchema);