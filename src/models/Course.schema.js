// course.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ModuleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    contentType: { type: String, enum: ['video', 'article', 'quiz', 'scorm', 'file'], default: 'video' },
    durationMinutes: { type: Number, default: 0 },
    resourceUrl: { type: String, trim: true },
    quizId: { type: Types.ObjectId, ref: 'Quiz' },
    order: { type: Number, default: 1 },
  },
  { _id: false }
);

const CourseSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },

    modules: { type: [ModuleSchema], default: [] },
    credits: { type: Number, default: 0 },
    certificateTemplateId: { type: Types.ObjectId, ref: 'CertificateTemplate' },

    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'courses' }
);

CourseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Course', CourseSchema);