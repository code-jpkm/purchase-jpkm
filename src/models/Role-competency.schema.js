// role-competency.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const RoleCompetencySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    designationId: { type: Types.ObjectId, ref: 'Designation', required: true, index: true },
    skillId: { type: Types.ObjectId, ref: 'Skill', required: true, index: true },
    minLevel: { type: Number, min: 1, max: 5, default: 3 },
  },
  { timestamps: true, versionKey: false, collection: 'role_competencies' }
);

RoleCompetencySchema.index({ tenantId: 1, designationId: 1, skillId: 1 }, { unique: true });
module.exports = mongoose.model('RoleCompetency', RoleCompetencySchema);