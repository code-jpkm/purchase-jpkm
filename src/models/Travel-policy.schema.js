// travel-policy.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const TravelPolicySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    rules: {
      flightClass: { type: String, enum: ['economy', 'premium-economy', 'business'], default: 'economy' },
      hotelCapPerNight: { type: Number, default: 0 },
      perDiem: { type: Number, default: 0 },
      requirePreApproval: { type: Boolean, default: true },
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'travel_policies' }
);

TravelPolicySchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('TravelPolicy', TravelPolicySchema);