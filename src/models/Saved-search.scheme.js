// saved-search.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Saved filters for list screens; shareable across users/roles.
 */
const SavedSearchSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    entityType: { type: String, required: true, trim: true }, // 'DailyAttendance'
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },

    ownerUserId: { type: Types.ObjectId, ref: 'User', index: true },
    sharedWithUserIds: [{ type: Types.ObjectId, ref: 'User' }],
    sharedWithRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],

    filters: Schema.Types.Mixed, // query JSON
    columns: [{ type: String }], // column set
    sort: Schema.Types.Mixed,
    isDefault: { type: Boolean, default: false },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'saved_searches' }
);

SavedSearchSchema.index({ tenantId: 1, entityType: 1, name: 1, ownerUserId: 1 }, { unique: true });

module.exports = mongoose.model('SavedSearch', SavedSearchSchema);