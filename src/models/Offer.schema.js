// offer.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const OfferComponentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ['monthly', 'annual', 'one-time'], default: 'monthly' },
  },
  { _id: false }
);

const OfferSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    applicationId: { type: Types.ObjectId, ref: 'Application', required: true, index: true },
    candidateId: { type: Types.ObjectId, ref: 'Candidate', required: true, index: true },
    openingId: { type: Types.ObjectId, ref: 'JobOpening', required: true, index: true },

    currency: { type: String, default: 'INR' },
    components: { type: [OfferComponentSchema], default: [] },
    annualCTC: { type: Number, default: 0 },
    joiningBonus: { type: Number, default: 0 },
    probationMonths: { type: Number, default: 6 },
    proposedJoiningDate: { type: Date },

    status: { type: String, enum: ['draft', 'extended', 'accepted', 'declined', 'expired', 'withdrawn'], default: 'draft', index: true },
    expiresAt: { type: Date },
    offerLetterUrl: { type: String, trim: true },
    esignEnvelopeId: { type: Types.ObjectId, ref: 'EsignEnvelope' },

    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'offers' }
);

OfferSchema.index({ tenantId: 1, applicationId: 1 }, { unique: true });

module.exports = mongoose.model('Offer', OfferSchema);