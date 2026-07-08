// project.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ProjectSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    clientName: { type: String, trim: true },
    description: { type: String, trim: true },

    startDate: { type: Date, index: true },
    endDate: { type: Date, index: true },
    status: { type: String, enum: ['planned', 'active', 'on-hold', 'completed', 'cancelled'], default: 'active', index: true },

    billable: { type: Boolean, default: false },
    defaultRateCardId: { type: Types.ObjectId, ref: 'RateCard' },

    managerEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile' },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'projects' }
);

ProjectSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Project', ProjectSchema);