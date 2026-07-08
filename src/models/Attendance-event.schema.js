// attendance-event.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Raw, append-only events. Never hard-delete. All calculations derive from this.
 */
const GeoSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], validate: v => Array.isArray(v) && v.length === 2 }, // [lng, lat]
    accuracy: { type: Number }, // meters
  },
  { _id: false }
);

const AttendanceEventSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    deviceId: { type: Types.ObjectId, ref: 'BiometricDevice', index: true },

    eventType: {
      type: String,
      required: true,
      enum: [
        'in',
        'out',
        'break-in',
        'break-out',
        'manual-in',
        'manual-out',
        'geo-in',
        'geo-out',
      ],
      index: true,
    },
    eventAt: { type: Date, required: true, index: true }, // UTC timestamp
    localTime: { type: String }, // "YYYY-MM-DDTHH:mm:ss" at device/location TZ for audit
    timezone: { type: String },

    source: { type: String, enum: ['biometric', 'web', 'mobile', 'api'], default: 'biometric', index: true },
    ip: { type: String, trim: true },
    geo: { type: GeoSchema },

    rawPayload: Schema.Types.Mixed, // vendor payload or client data
    importBatchId: { type: Types.ObjectId }, // for bulk imports

    // De-duplication support
    dedupeHash: { type: String, index: true },

    // Processing pointers
    processed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date },
    dailyAttendanceId: { type: Types.ObjectId, ref: 'DailyAttendance' },

    // Tamper/override markers
    isEdited: { type: Boolean, default: false },
    editedByUserId: { type: Types.ObjectId, ref: 'User' },
    editReason: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true }, // soft delete, never hard-delete
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'attendance_events' }
);

AttendanceEventSchema.index({ tenantId: 1, employeeId: 1, eventAt: 1 });
AttendanceEventSchema.index({ tenantId: 1, processed: 1, eventAt: 1 });
AttendanceEventSchema.index({ tenantId: 1, dedupeHash: 1 }, { unique: true, partialFilterExpression: { dedupeHash: { $type: 'string' } } });

module.exports = mongoose.model('AttendanceEvent', AttendanceEventSchema);