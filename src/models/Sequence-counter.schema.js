// sequence-counter.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Numbering sequences used by formats (e.g., EMP-{YYYY}-{SEQ4}).
 */
const SequenceCounterSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    key: { type: String, required: true, trim: true, uppercase: true }, // 'EMPLOYEE_CODE', 'PAYSLIP_NO'
    format: { type: String, required: true, trim: true }, // e.g., 'EMP-{YYYY}-{SEQ4}'
    nextValue: { type: Number, default: 1 },
    pad: { type: Number, default: 4 }, // if using SEQ{pad}
    lastResetAt: { type: Date },
    resetStrategy: { type: String, enum: ['never', 'yearly', 'monthly'], default: 'yearly' },

    previewExample: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'sequence_counters' }
);

SequenceCounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('SequenceCounter', SequenceCounterSchema);