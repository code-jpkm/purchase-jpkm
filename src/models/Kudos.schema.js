// kudos.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const KudosSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    fromEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    toEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    awardId: { type: Types.ObjectId, ref: 'Award' },
    points: { type: Number, default: 0 },

    message: { type: String, trim: true },
    public: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'kudos' }
);

KudosSchema.index({ tenantId: 1, toEmployeeId: 1, createdAt: 1 });
module.exports = mongoose.model('Kudos', KudosSchema);