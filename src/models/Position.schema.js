// position.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PositionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    departmentId: { type: Types.ObjectId, ref: 'Department', index: true },
    locationId: { type: Types.ObjectId, ref: 'Location', index: true },
    headcountApproved: { type: Number, default: 1 },
    headcountFilled: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'frozen', 'closed'], default: 'open', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'positions' }
);

PositionSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Position', PositionSchema);