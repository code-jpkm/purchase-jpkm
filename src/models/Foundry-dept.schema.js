const mongoose = require('mongoose');
const { Schema } = mongoose;

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true }, // short code e.g. "MELT", "CAST"
    description: { type: String, trim: true },
    hodName: { type: String, trim: true },     // Head of Department
    hodEmail: { type: String, trim: true },
    hodWhatsApp: { type: String, trim: true },
    budgetAlertEmails: [{ type: String, trim: true }],
    budgetAlertWhatsApp: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: false }
);

const FoundrySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },       // "D.I" or "C.I"
    fullName: { type: String, trim: true },                   // "Ductile Iron" / "Cast Iron"
    code: { type: String, required: true, trim: true, uppercase: true }, // "DI" / "CI"
    description: { type: String, trim: true },
    departments: [DepartmentSchema],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'foundries',
  }
);

FoundrySchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Foundry', FoundrySchema);
