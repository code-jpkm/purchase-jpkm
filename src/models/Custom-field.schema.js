// custom-field.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const FieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'number', 'date', 'select', 'multi-select', 'boolean'], required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    defaultValue: Schema.Types.Mixed,
  },
  { _id: false }
);

const CustomFieldSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    entityType: { type: String, required: true, trim: true }, // e.g., 'EmployeeProfile', 'Project', 'Asset'
    fields: { type: [FieldSchema], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'custom_fields' }
);

CustomFieldSchema.index({ tenantId: 1, entityType: 1 }, { unique: true });

module.exports = mongoose.model('CustomField', CustomFieldSchema);