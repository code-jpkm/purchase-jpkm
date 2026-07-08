// skill.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SkillSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    category: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'skills' }
);

SkillSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Skill', SkillSchema);