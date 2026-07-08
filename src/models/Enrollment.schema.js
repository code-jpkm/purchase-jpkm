// enrollment.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ProgressModuleSchema = new Schema(
  {
    moduleIndex: { type: Number, required: true },
    completedAt: { type: Date },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const EnrollmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    courseId: { type: Types.ObjectId, ref: 'Course', required: true, index: true },
    sessionId: { type: Types.ObjectId, ref: 'Session' },

    status: { type: String, enum: ['enrolled', 'in-progress', 'completed', 'failed', 'withdrawn'], default: 'enrolled', index: true },
    progressPercent: { type: Number, default: 0 },
    modules: { type: [ProgressModuleSchema], default: [] },

    certificateId: { type: Types.ObjectId, ref: 'Certificate' },
  },
  { timestamps: true, versionKey: false, collection: 'enrollments' }
);

EnrollmentSchema.index({ tenantId: 1, employeeId: 1, courseId: 1 }, { unique: true });
module.exports = mongoose.model('Enrollment', EnrollmentSchema);