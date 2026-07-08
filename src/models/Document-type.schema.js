// document-type.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DocumentTypeSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    requiredFor: { type: [String], default: [] }, // e.g., ['onboarding', 'kyc', 'benefits']
    validityMonths: { type: Number, default: 0 }, // 0 = no expiry
    sensitive: { type: Boolean, default: false },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'document_types' }
);

DocumentTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('DocumentType', DocumentTypeSchema);