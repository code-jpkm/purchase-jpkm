const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'store_manager', 'purchase_manager', 'accounts', 'department_user', 'viewer'],
      default: 'viewer',
      index: true,
    },
    permissions: [{ type: String, trim: true }],
    // User scope is optional. UI sends empty string when "All" is selected; convert it to null
    // so Mongoose enum validation does not fail during create/edit.
    foundry: {
      type: String,
      enum: ['D. I', 'C. I', null],
      default: null,
      set: (v) => (v === '' || v === undefined ? null : v),
    },
    department: {
      type: String,
      trim: true,
      default: null,
      set: (v) => (v === '' || v === undefined ? null : v),
    },
    departmentScopes: [{
      foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
      department: { type: String, required: true, trim: true },
      isBudgetHead: { type: Boolean, default: false },
    }],
    budgetOverrideUntil: { type: Date },
    ssoProvider: { type: String, enum: [null, 'google', 'microsoft', 'okta'], default: null },
    isActive: { type: Boolean, default: true, index: true },
    mfaEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastSeenAt: { type: Date },
    isOnline: { type: Boolean, default: false, index: true },
    preferences: {
      locale: { type: String, default: 'en-IN' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notificationChannels: {
        email: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        inapp: { type: Boolean, default: true },
      },
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'users' }
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1, isActive: 1 });
UserSchema.index({ phone: 1 });

module.exports = mongoose.model('User', UserSchema);
