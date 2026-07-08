// session.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SessionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    courseId: { type: Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    trainerUserId: { type: Types.ObjectId, ref: 'User' },

    mode: { type: String, enum: ['virtual', 'in-person'], default: 'virtual' },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },

    capacity: { type: Number, default: 0 },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'sessions' }
);

SessionSchema.index({ tenantId: 1, courseId: 1, startAt: 1 });
module.exports = mongoose.model('Session', SessionSchema);