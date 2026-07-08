// learning-path.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PathCourseSchema = new Schema(
  {
    courseId: { type: Types.ObjectId, ref: 'Course', required: true },
    mandatory: { type: Boolean, default: true },
    order: { type: Number, default: 1 },
  },
  { _id: false }
);

const LearningPathSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    courses: { type: [PathCourseSchema], default: [] },
    audience: {
      locations: [{ type: Types.ObjectId, ref: 'Location' }],
      departments: [{ type: Types.ObjectId, ref: 'Department' }],
      designations: [{ type: Types.ObjectId, ref: 'Designation' }],
    },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'learning_paths' }
);

LearningPathSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('LearningPath', LearningPathSchema);