// location.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AddressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const GeoFencePolygonSchema = new Schema(
  {
    type: { type: String, enum: ['Polygon'], default: 'Polygon' },
    coordinates: {
      type: [[[Number]]], // array of linear rings
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'coordinates must be a non-empty Polygon',
      },
    },
  },
  { _id: false }
);

const PointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false }
);

const LocationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },

    address: { type: AddressSchema, default: {} },
    center: { type: PointSchema }, // for maps/proximity
    geoFence: { type: GeoFencePolygonSchema }, // optional polygon for geofencing punches
    geoFenceRequiredForPunch: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'locations' }
);

LocationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LocationSchema.index({ tenantId: 1, name: 1 });
LocationSchema.index({ center: '2dsphere' });
LocationSchema.index({ 'geoFence': '2dsphere' });

module.exports = mongoose.model('Location', LocationSchema);