// session-token.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SessionTokenSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true }, // store hash of refresh token or session token
    userAgent: { type: String },
    ip: { type: String },
    validUntil: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    reason: { type: String },
  },
  { timestamps: true, versionKey: false, collection: 'session_tokens' }
);

SessionTokenSchema.index({ tenantId: 1, userId: 1, tokenHash: 1 }, { unique: true });

module.exports = mongoose.model('SessionToken', SessionTokenSchema);