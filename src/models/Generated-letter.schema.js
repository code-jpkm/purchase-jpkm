// generated-letter.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const GeneratedLetterSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    templateId: { type: Types.ObjectId, ref: 'LetterTemplate', required: true, index: true },

    payload: Schema.Types.Mixed, // resolved variables
    pdfUrl: { type: String, trim: true },
    issuedAt: { type: Date, default: Date.now },

    signed: { type: Boolean, default: false, index: true },
    esignEnvelopeId: { type: Types.ObjectId, ref: 'EsignEnvelope' },
  },
  { timestamps: true, versionKey: false, collection: 'generated_letters' }
);

GeneratedLetterSchema.index({ tenantId: 1, employeeId: 1, templateId: 1, issuedAt: 1 });

module.exports = mongoose.model('GeneratedLetter', GeneratedLetterSchema);