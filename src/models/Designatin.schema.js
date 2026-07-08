// designation.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DesignationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    level: { type: Number, default: 0, index: true }, // seniority band for policies/workflows
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'designations' }
);

DesignationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
DesignationSchema.index({ tenantId: 1, title: 1 });

module.exports = mongoose.model('Designation', DesignationSchema);