// import-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * CSV/XLSX import templates with mapping and validation.
 */
const ColumnMapSchema = new Schema(
  {
    header: { type: String, required: true, trim: true },  // column name in file
    path: { type: String, required: true, trim: true },    // target field path
    required: { type: Boolean, default: false },
    transform: { type: String, trim: true },               // transformation expression
    validator: { type: String, trim: true },               // validation expression
  },
  { _id: false }
);

const ImportTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    entityType: { type: String, required: true, trim: true }, // 'EmployeeProfile', 'AttendanceEvent'
    columnMap: { type: [ColumnMapSchema], default: [] },

    dedupeKey: { type: String, trim: true }, // expression to dedupe rows
    upsert: { type: Boolean, default: true },

    sampleUrl: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'import_templates' }
);

ImportTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ImportTemplate', ImportTemplateSchema);