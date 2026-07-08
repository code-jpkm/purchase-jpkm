// candidate.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CandidateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },

    resumeUrl: { type: String, trim: true },
    portfolioUrl: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },

    experienceYears: { type: Number, default: 0 },
    skills: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    source: { type: String, enum: ['career-site', 'referral', 'agency', 'linkedin', 'job-board', 'other'], default: 'career-site', index: true },
    consentToStoreData: { type: Boolean, default: true },

    blacklisted: { type: Boolean, default: false, index: true },
    notes: { type: String, trim: true },

    // Talent pool segmentation
    pools: [{ type: String }],

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'candidates' }
);

CandidateSchema.index({ tenantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Candidate', CandidateSchema);