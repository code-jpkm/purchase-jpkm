const mongoose = require('mongoose');
const { Schema } = mongoose;

// Item-wise GRN (Goods Receipt Note) — maps to "Item Wise FMS" sheet
const GoodsReceiptSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    // Reference
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    poNo: { type: String, required: true },
    subPOId: { type: Schema.Types.ObjectId }, // ref to SubPO _id
    subPoNo: { type: String },

    // Vendor
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: { type: String, required: true },

    // Item
    skuCode: { type: String, required: true },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    department: { type: String, required: true },
    itemDescription: { type: String, required: true },
    uom: { type: String, required: true },
    secondaryUom: { type: String },
    secondaryQtyReceived: { type: Number, default: 0 },

    // Quantities
    orderedQty: { type: Number, required: true },
    receivedQty: { type: Number, required: true, min: 0 }, // actual physical received qty
    invoiceBillQty: { type: Number, default: 0 }, // qty as per invoice/bill
    physicalReceivedQty: { type: Number, default: 0 },
    shortExcessQty: { type: Number, default: 0 },
    noteType: { type: String, enum: ['None', 'Debit Note', 'Credit Note'], default: 'None' },
    noteNo: { type: String },
    noteQty: { type: Number, default: 0 },
    noteValue: { type: Number, default: 0 },
    balanceQty: { type: Number, default: 0 },
    excessQty: { type: Number, default: 0 },
    returnedQty: { type: Number, default: 0 }, // partial or full returns

    // Delivery dates
    expectedDeliveryDate: { type: Date },
    actualReceiptDate: { type: Date, default: Date.now },
    deliveryDelayDays: { type: Number, default: 0 },
    deliveryStatus: { type: String, enum: ['On Time', 'Delayed', 'Early', 'NO DELAY'], default: 'NO DELAY' },

    workflowStages: [{
      key: String,
      order: Number,
      what: String,
      who: String,
      how: String,
      planned: Date,
      actual: Date,
      status: { type: String, default: 'Pending' },
      timeDelay: String,
      tatDays: Number,
      plannedMode: { type: String, default: 'tat' },
      statusOptions: [String],
      assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      assignedUserName: String,
      assignedUserEmail: String,
      assignedUserWhatsapp: String,
      buddyUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      buddyUserName: String,
      buddyUserEmail: String,
      buddyUserWhatsapp: String,
    }],

    // Gate checklist (Stage: receive material)
    gateChecklistDone: { type: Boolean, default: false },
    gateChecklistAt: { type: Date },

    // QC stage
    qqCheckPassed: { type: Boolean, default: null }, // null = pending
    qqCheckPlanned: { type: Date },
    qqCheckActual: { type: Date },
    qqCheckStatus: { type: String, enum: ['Pending', 'Passed', 'Failed'], default: 'Pending' },
    qqCheckDelay: { type: String },

    // Return (if QC failed)
    materialReturned: { type: Boolean, default: false },
    returnedAt: { type: Date },
    returnReason: { type: String },
    returnedQtyPartial: { type: Number, default: 0 },

    // Store stage: stock added to store
    stockAdded: { type: Boolean, default: false },
    stockAddedAt: { type: Date },
    storePlanned: { type: Date },
    storeActual: { type: Date },
    storeStatus: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },

    // Invoice
    invoiceNo: { type: String },
    challanNo: { type: String },
    invoiceDate: { type: Date },
    invoiceChecked: { type: Boolean, default: false },
    invoiceFileName: { type: String },
    invoiceFileMime: { type: String },
    invoiceFileData: { type: String }, // data URL/base64 for small uploads; replace with S3 later if needed

    // Send to HO
    invoiceSentToHOPlanned: { type: Date },
    invoiceSentToHOActual: { type: Date },
    invoiceSentToHOStatus: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },

    // Accounts
    accountsPlanned: { type: Date },
    accountsActual: { type: Date },
    accountsStatus: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },

    // Rate / value
    rate: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },

    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receivedByName: { type: String },

    status: {
      type: String,
      enum: ['Pending QC', 'QC Passed', 'QC Failed', 'Stocked', 'Returned', 'Partially Returned'],
      default: 'Pending QC',
      index: true,
    },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'goods_receipts' }
);

GoodsReceiptSchema.index({ tenantId: 1, poNo: 1 });
GoodsReceiptSchema.index({ tenantId: 1, skuCode: 1 });
GoodsReceiptSchema.index({ tenantId: 1, status: 1 });
GoodsReceiptSchema.index({ tenantId: 1, actualReceiptDate: -1 });

module.exports = mongoose.model('GoodsReceipt', GoodsReceiptSchema);
