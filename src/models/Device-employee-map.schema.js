// device-employee-map.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DeviceEmployeeMapSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    deviceId: { type: Types.ObjectId, ref: 'BiometricDevice', required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },

    deviceEmployeeCode: { type: String, required: true, trim: true }, // enrollment code on the device
    enrolledAt: { type: Date, default: Date.now },
    templatesInfo: {
      fingersEnrolled: { type: Number, default: 0 },
      faceEnrolled: { type: Boolean, default: false },
      cardNumber: { type: String, trim: true },
    },
    lastSeenAt: { type: Date },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'device_employee_maps' }
);

DeviceEmployeeMapSchema.index(
  { tenantId: 1, deviceId: 1, employeeId: 1 },
  { unique: true }
);
DeviceEmployeeMapSchema.index({ tenantId: 1, deviceEmployeeCode: 1 });

module.exports = mongoose.model('DeviceEmployeeMap', DeviceEmployeeMapSchema);