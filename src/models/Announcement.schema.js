// announcement.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AudienceSchema = new Schema(
  {
    type: { type: String, enum: ['all', 'roles', 'departments', 'locations', 'employees'], required: true },
    roleIds: [{ type: Types.ObjectId, ref: 'Role' }],
    departmentIds: [{ type: Types.ObjectId, ref: 'Department' }],
    locationIds: [{ type: Types.ObjectId, ref: 'Location' }],
    employeeIds: [{ type: Types.ObjectId, ref: 'EmployeeProfile' }],
  },
  { _id: false }
);

const AnnouncementSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    attachments: { type: [String], default: [] },

    audience: { type: AudienceSchema, required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, index: true },

    pinned: { type: Boolean, default: false, index: true },
    createdByUserId: { type: Types.ObjectId, ref: 'User' },

    readReceiptsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'announcements' }
);

AnnouncementSchema.index({ tenantId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);