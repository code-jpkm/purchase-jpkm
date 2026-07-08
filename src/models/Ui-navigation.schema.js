// ui-navigation.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Tenant-level configurable navigation/menu structure with role-based visibility.
 */
const NavItemSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    route: { type: String, required: true, trim: true }, // e.g., '/attendance'
    icon: { type: String, trim: true }, // optional icon key
    visibleToRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],
    children: [this],
  },
  { _id: false }
);

const UINavSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', unique: true, index: true },
    items: { type: [NavItemSchema], default: [] },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'ui_navigation' }
);

module.exports = mongoose.model('UINavigation', UINavSchema);