// certificate.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CertificateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    templateId: { type: Types.ObjectId, ref: 'CertificateTemplate', required: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    courseId: { type: Types.ObjectId, ref: 'Course' },

    payload: Schema.Types.Mixed,
    pdfUrl: { type: String, trim: true },
    issuedAt: { type: Date, default: Date.now },

    revoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date },
    reason: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'certificates' }
);

CertificateSchema.index({ tenantId: 1, employeeId: 1, templateId: 1, issuedAt: 1 });
module.exports = mongoose.model('Certificate', CertificateSchema);