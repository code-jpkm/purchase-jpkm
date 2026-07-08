// employee-profile.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AddressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
    type: { type: String, enum: ['current', 'permanent'], required: true },
  },
  { _id: false }
);

const EmergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    relation: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const BankDetailSchema = new Schema(
  {
    accountHolder: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
    upiId: { type: String, trim: true, lowercase: true },
    isPrimary: { type: Boolean, default: true },
  },
  { _id: false }
);

const StatutoryIdSchema = new Schema(
  {
    pan: { type: String, trim: true, uppercase: true },
    uan: { type: String, trim: true },
    esi: { type: String, trim: true },
    aadhaarLast4: { type: String, trim: true },
    // add more as needed per geography
  },
  { _id: false }
);

const EmployeeProfileSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

    employeeCode: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'probation', 'on-leave', 'terminated', 'resigned'], default: 'active', index: true },

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], index: true },
    dob: { type: Date },
    photoUrl: { type: String },

    doj: { type: Date, required: true, index: true }, // date of joining
    dol: { type: Date }, // date of leaving

    officialEmail: { type: String, lowercase: true, trim: true },
    workPhone: { type: String, trim: true },
    personalEmail: { type: String, lowercase: true, trim: true },
    personalPhone: { type: String, trim: true },

    departmentId: { type: Types.ObjectId, ref: 'Department', index: true },
    designationId: { type: Types.ObjectId, ref: 'Designation', index: true },
    locationId: { type: Types.ObjectId, ref: 'Location', index: true },
    costCenterId: { type: Types.ObjectId, ref: 'CostCenter', index: true },
    reportingManagerEmployeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', index: true },

    addresses: { type: [AddressSchema], default: [] },
    emergencyContacts: { type: [EmergencyContactSchema], default: [] },
    bankDetails: { type: [BankDetailSchema], default: [] },
    statutoryIds: { type: StatutoryIdSchema, default: {} },

    workMode: { type: String, enum: ['on-site', 'remote', 'hybrid'], default: 'on-site' },
    employmentType: { type: String, enum: ['permanent', 'contract', 'intern', 'part-time'], default: 'permanent' },
    shiftPreferenceId: { type: Types.ObjectId, ref: 'Shift' }, // preferred shift

    tags: { type: [String], default: [] },
    notes: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'employee_profiles' }
);

EmployeeProfileSchema.index({ tenantId: 1, employeeCode: 1 }, { unique: true });
EmployeeProfileSchema.index({ tenantId: 1, departmentId: 1 });
EmployeeProfileSchema.index({ tenantId: 1, reportingManagerEmployeeId: 1 });

module.exports = mongoose.model('EmployeeProfile', EmployeeProfileSchema);