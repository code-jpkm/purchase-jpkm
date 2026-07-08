// esign-envelope.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Generic e-sign envelope for integration with providers (e.g., Adobe Sign, DocuSign).
 */
const SignerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    order: { type: Number, default: 1 },
    signedAt: { type: Date },
    status: { type: String, enum: ['pending', 'sent', 'signed', 'declined'], default: 'pending' },
  },
  { _id: false }
);

const EsignEnvelopeSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    provider: { type: String, required: true, trim: true }, // 'adobe', 'docusign', etc.
    externalId: { type: String, trim: true }, // envelope id on provider
    documentUrl: { type: String, trim: true },
    signers: { type: [SignerSchema], default: [] },

    status: { type: String, enum: ['draft', 'sent', 'completed', 'declined', 'expired'], default: 'draft', index: true },
    sentAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, trim: true },

    entityRef: {
      type: { type: String }, // e.g., 'GeneratedLetter'
      id: { type: Types.ObjectId },
    },
  },
  { timestamps: true, versionKey: false, collection: 'esign_envelopes' }
);

EsignEnvelopeSchema.index({ tenantId: 1, provider: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });

module.exports = mongoose.model('EsignEnvelope', EsignEnvelopeSchema);