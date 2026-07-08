// biometric-device.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PullConfigSchema = new Schema(
  {
    mode: { type: String, enum: ['poll', 'push'], default: 'poll' },
    pollIntervalSeconds: { type: Number, default: 300 },
    endpointUrl: { type: String, trim: true }, // for push/callback
    secret: { type: String, trim: true },
  },
  { _id: false }
);

const BiometricDeviceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    vendor: { type: String, required: true, trim: true }, // e.g., ZKTeco, eSSL
    model: { type: String, trim: true },
    deviceUid: { type: String, required: true, trim: true }, // unique identifier on vendor side
    serialNumber: { type: String, trim: true },
    name: { type: String, trim: true },
    locationId: { type: Types.ObjectId, ref: 'Location', index: true },

    timezone: { type: String, default: 'Asia/Kolkata' },
    lastSyncAt: { type: Date },
    status: { type: String, enum: ['online', 'offline', 'disabled'], default: 'offline', index: true },

    pullConfig: { type: PullConfigSchema, default: {} },
    vendorConfig: { type: Map, of: String, default: {} },

    rawRetentionDays: { type: Number, default: 90 }, // retain raw payload
    allowMobileFallback: { type: Boolean, default: false }, // if device offline

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'biometric_devices' }
);

BiometricDeviceSchema.index({ tenantId: 1, deviceUid: 1 }, { unique: true });
BiometricDeviceSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('BiometricDevice', BiometricDeviceSchema);