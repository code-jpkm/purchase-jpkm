// project-task.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ProjectTaskSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    projectId: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },

    billable: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'project_tasks' }
);

ProjectTaskSchema.index({ tenantId: 1, projectId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ProjectTask', ProjectTaskSchema);