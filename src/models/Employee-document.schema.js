// employee-document.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const EmployeeDocumentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    typeId: { type: Types.ObjectId, ref: 'DocumentType', required: true, index: true },

    title: { type: String, trim: true },
    storageUrl: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedByUserId: { type: Types.ObjectId, ref: 'User' },

    verified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedByUserId: { type: Types.ObjectId, ref: 'User' },

    expiresAt: { type: Date, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'employee_documents' }
);

EmployeeDocumentSchema.index({ tenantId: 1, employeeId: 1, typeId: 1, storageUrl: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeDocument', EmployeeDocumentSchema);