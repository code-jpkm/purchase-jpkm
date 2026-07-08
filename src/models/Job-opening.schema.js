// job-opening.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Public-facing opening derived from an approved requisition.
 */
const ChannelSchema = new Schema(
  {
    channel: { type: String, enum: ['career-site', 'linkedin', 'indeed', 'referral', 'agency', 'other'], required: true },
    url: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const JobOpeningSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    requisitionId: { type: Types.ObjectId, ref: 'JobRequisition', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true },
    departmentId: { type: Types.ObjectId, ref: 'Department', index: true },
    locationId: { type: Types.ObjectId, ref: 'Location', index: true },

    descriptionHtml: { type: String, required: true }, // JD
    skills: { type: [String], default: [] }, // tags for search
    employmentType: { type: String, enum: ['permanent', 'contract', 'intern', 'part-time'], default: 'permanent' },

    headcount: { type: Number, required: true, default: 1 },
    openingsFilled: { type: Number, default: 0 },

    channels: { type: [ChannelSchema], default: [] },

    status: { type: String, enum: ['draft', 'published', 'on-hold', 'closed'], default: 'published', index: true },
    publishAt: { type: Date },
    closeAt: { type: Date },

    hiringManagerId: { type: Types.ObjectId, ref: 'EmployeeProfile' },
    recruiterUserId: { type: Types.ObjectId, ref: 'User' },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'job_openings' }
);

JobOpeningSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('JobOpening', JobOpeningSchema);