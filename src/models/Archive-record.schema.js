// archive-record.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Pointer to archived payloads stored in cold storage (S3/Blob). Original may be removed or masked.
 */
const ArchiveRecordSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    entityType: { type: String, required: true, trim: true },
    entityId: { type: Types.ObjectId, required: true, index: true },

    archivedAt: { type: Date, default: Date.now, index: true },
    archiveUrl: { type: String, required: true, trim: true },
    checksum: { type: String, trim: true },
    sizeBytes: { type: Number, default: 0 },

    reason: { type: String, trim: true }, // per retention policy or manual
    requestedByUserId: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false, collection: 'archive_records' }
);

ArchiveRecordSchema.index({ tenantId: 1, entityType: 1, entityId: 1 }, { unique: true });

module.exports = mongoose.model('ArchiveRecord', ArchiveRecordSchema);