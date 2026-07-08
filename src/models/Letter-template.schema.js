// letter-template.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const LetterTemplateSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    htmlTemplate: { type: String, required: true }, // handlebars/HTML string
    variables: { type: [String], default: [] },
    digitallySign: { type: Boolean, default: false },

    category: { type: String, trim: true }, // e.g., 'offer', 'increment', 'experience'
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'letter_templates' }
);

LetterTemplateSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('LetterTemplate', LetterTemplateSchema);