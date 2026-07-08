// employee-skill.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const EmployeeSkillSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    skillId: { type: Types.ObjectId, ref: 'Skill', required: true, index: true },

    level: { type: Number, min: 1, max: 5, default: 3 }, // proficiency
    verified: { type: Boolean, default: false },
    verifiedByUserId: { type: Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    evidenceUrls: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'employee_skills' }
);

EmployeeSkillSchema.index({ tenantId: 1, employeeId: 1, skillId: 1 }, { unique: true });
module.exports = mongoose.model('EmployeeSkill', EmployeeSkillSchema);