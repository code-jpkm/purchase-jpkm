// data-export.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DataExportSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    type: { type: String, required: true, trim: true }, // entity or custom report
    params: Schema.Types.Mixed,
    fileUrl: { type: String, trim: true },
    format: { type: String, enum: ['csv', 'xlsx', 'json'], default: 'csv' },

    status: { type: String, enum: ['queued', 'processing', 'done', 'failed'], default: 'queued', index: true },
    generatedAt: { type: Date },
    error: { type: String, trim: true },

    requestedByUserId: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false, collection: 'data_exports' }
);

DataExportSchema.index({ tenantId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('DataExport', DataExportSchema);