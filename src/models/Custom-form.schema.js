// custom-form.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const FormFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'number', 'date', 'select', 'multi-select', 'boolean', 'file'], required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    placeholder: { type: String, trim: true },
  },
  { _id: false }
);

const CustomFormSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    entityType: { type: String, required: true, trim: true }, // used to attach submissions to entity
    schema: { type: [FormFieldSchema], default: [] },

    usedIn: { type: [String], default: [] }, // e.g., ['onboarding', 'requests']
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'custom_forms' }
);

CustomFormSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('CustomForm', CustomFormSchema);