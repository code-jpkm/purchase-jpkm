// certificate-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CertificateTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    htmlTemplate: { type: String, required: true },
    variables: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'certificate_templates' }
);

CertificateTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('CertificateTemplate', CertificateTemplateSchema);