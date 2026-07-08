// sync-job.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * External integration sync jobs (biometric pulls, accounting exports, Slack broadcasts).
 */
const SyncJobSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    integrationId: { type: Types.ObjectId, ref: 'Integration', required: true, index: true },
    jobType: { type: String, required: true, trim: true }, // 'biometric.pull', 'accounting.export', ...
    status: { type: String, enum: ['queued', 'running', 'succeeded', 'failed'], default: 'queued', index: true },

    schedule: { type: String, trim: true }, // optional cron if periodic
    payload: Schema.Types.Mixed,

    metrics: Schema.Types.Mixed, // rowsProcessed, newEvents, etc.
    error: { type: String, trim: true },

    startedAt: { type: Date },
    completedAt: { type: Date },

    createdByUserId: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false, collection: 'sync_jobs' }
);

SyncJobSchema.index({ tenantId: 1, integrationId: 1, status: 1 });

module.exports = mongoose.model('SyncJob', SyncJobSchema);