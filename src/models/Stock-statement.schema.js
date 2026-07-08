const mongoose = require('mongoose');
const { Schema } = mongoose;

// Monthly stock statement per item (for accounts)
const StockStatementLineSchema = new Schema(
  {
    slNo: { type: Number },
    skuCode: { type: String },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem' },
    itemName: { type: String, required: true },
    uom: { type: String, required: true },
    openingStock: { type: Number, default: 0 },
    invoiceQty: { type: Number, default: 0 }, // received during month
    shortageExcessQty: { type: Number, default: 0 },
    receivedDate: { type: Date },
    totalQty: { type: Number, default: 0 }, // opening + received
    consumedDI: { type: Number, default: 0 },
    consumedCI: { type: Number, default: 0 },
    closingStock: { type: Number, default: 0 },
    productCategory: { type: String },
    preference: { type: Number },
    status: { type: String },
    childCount: { type: Number, default: 1 },
    childItems: [{ type: String }],
    averageRate: { type: Number, default: 0 },
    midMonthStockTaken: { type: Number, default: 0 }, // 15th of month stock
    sendToMonthlyStock: { type: Boolean, default: false },
  },
  { _id: false }
);

const StockStatementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 }, // 1-12
    monthLabel: { type: String }, // e.g. "May-2026"
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    // Split dates (1-15 and 16-end)
    firstHalfEnd: { type: Date }, // 15th
    secondHalfStart: { type: Date }, // 16th

    totalWorkingDays: { type: Number, default: 26 },

    lines: [StockStatementLineSchema],

    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    generatedAt: { type: Date, default: Date.now },
    isFinalised: { type: Boolean, default: false },
    finalisedAt: { type: Date },
    finalisedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false, collection: 'stock_statements' }
);

StockStatementSchema.index({ tenantId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('StockStatement', StockStatementSchema);
