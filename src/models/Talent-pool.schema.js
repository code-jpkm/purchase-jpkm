// talent-pool.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Curated pools for future hiring; simple segmentation to run campaigns later.
 */
const TalentPoolSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    criteria: Schema.Types.Mixed, // saved search-like filters
    candidateIds: [{ type: Types.ObjectId, ref: 'Candidate' }],

    active: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'talent_pools' }
);

TalentPoolSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('TalentPool', TalentPoolSchema);