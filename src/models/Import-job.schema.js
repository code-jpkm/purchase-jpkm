// import-job.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Execution of an import using a template; tracks successes and errors.
 */
const ImportJobSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    templateId: { type: Types.ObjectId, ref: 'ImportTemplate', required: true, index: true },
    source: { type: String, enum: ['file', 'api'], default: 'file' },
    fileUrl: { type: String, trim: true },

    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued', index: true },
    totalRows: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },

    errorReportUrl: { type: String, trim: true },
    logsUrl: { type: String, trim: true },

    startedAt: { type: Date },
    completedAt: { type: Date },

    createdByUserId: { type: Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'import_jobs' }
);

ImportJobSchema.index({ tenantId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('ImportJob', ImportJobSchema);