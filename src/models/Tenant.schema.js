// tenant.schema.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const TenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    status: { type: String, enum: ['active', 'suspended', 'closed'], default: 'active', index: true },
    countryCode: { type: String, required: true, uppercase: true },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },
    fiscalYearStart: { type: String, default: '04-01' }, // MM-DD
    featureFlags: { type: Map, of: Boolean, default: {} },
    branding: {
      logoUrl: String,
      primaryColor: String,
      accentColor: String,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'tenants' }
);

TenantSchema.index({ status: 1 });
TenantSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Tenant', TenantSchema);