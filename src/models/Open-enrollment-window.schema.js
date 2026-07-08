// open-enrollment-window.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ScopeSchema = new Schema(
  {
    scopeType: { type: String, enum: ['company', 'location', 'department', 'grade'], required: true },
    scopeId: { type: Types.ObjectId }, // null for company
    grade: { type: String }, // when scopeType='grade'
  },
  { _id: false }
);

const OpenEnrollmentWindowSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    fiscalYear: { type: String, required: true, trim: true, index: true }, // "2025-2026"
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },

    planIds: [{ type: Types.ObjectId, ref: 'BenefitPlan', required: true }],
    scopes: { type: [ScopeSchema], default: [] },

    status: { type: String, enum: ['scheduled', 'open', 'closed'], default: 'scheduled', index: true },
    allowChangesUntil: { type: Date },

    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'open_enrollment_windows' }
);

OpenEnrollmentWindowSchema.index({ tenantId: 1, fiscalYear: 1, startAt: 1 });

module.exports = mongoose.model('OpenEnrollmentWindow', OpenEnrollmentWindowSchema);