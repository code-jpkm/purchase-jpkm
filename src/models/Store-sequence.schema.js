const mongoose = require('mongoose');
const { Schema } = mongoose;

// Auto-increment sequences for document numbering
const StoreSequenceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    type: {
      type: String,
      required: true,
      enum: ['INDENT', 'INDENT_HO', 'PO', 'PO_HO', 'OUTWARD', 'REQUISITION', 'IDT', 'GRN', 'VENDOR', 'QSF_PUR', 'STORE_ITEM', 'HELP_TICKET'],
    },
    fiscalYear: { type: String, required: true }, // e.g. "25-26"
    currentSeq: { type: Number, default: 0 },
    prefix: { type: String, required: true },
  },
  { versionKey: false, collection: 'store_sequences' }
);

StoreSequenceSchema.index({ tenantId: 1, type: 1, fiscalYear: 1 }, { unique: true });

StoreSequenceSchema.statics.nextSeq = async function (tenantId, type, fiscalYear, prefix) {
  const doc = await this.findOneAndUpdate(
    { tenantId, type, fiscalYear },
    { $inc: { currentSeq: 1 }, $setOnInsert: { prefix } },
    { upsert: true, new: true }
  );
  return doc.currentSeq;
};

module.exports = mongoose.model('StoreSequence', StoreSequenceSchema);
