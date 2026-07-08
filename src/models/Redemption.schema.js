// redemption.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RedemptionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    points: { type: Number, required: true },
    reward: { type: String, required: true, trim: true }, // e.g., 'Amazon voucher'
    status: { type: String, enum: ['requested', 'fulfilled', 'rejected'], default: 'requested', index: true },
    fulfilledAt: { type: Date },
    reference: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'redemptions' }
);

RedemptionSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
module.exports = mongoose.model('Redemption', RedemptionSchema);