// opportunity-gig.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const OpportunityGigSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    skills: [{ type: Types.ObjectId, ref: 'Skill' }],
    projectId: { type: Types.ObjectId, ref: 'Project' },
    hoursPerWeek: { type: Number, default: 4 },
    durationWeeks: { type: Number, default: 4 },

    postedByUserId: { type: Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['open', 'filled', 'closed'], default: 'open', index: true },
    applicants: [{ type: Types.ObjectId, ref: 'EmployeeProfile' }],
    selectedEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile' },
  },
  { timestamps: true, versionKey: false, collection: 'opportunity_gigs' }
);

OpportunityGigSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
module.exports = mongoose.model('OpportunityGig', OpportunityGigSchema);