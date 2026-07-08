// award.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AwardSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    points: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'awards' }
);

AwardSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Award', AwardSchema);