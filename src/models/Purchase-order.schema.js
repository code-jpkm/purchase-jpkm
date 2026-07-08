const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-PO line (one item per sub-PO number)
const SubPOSchema = new Schema(
  {
    subPoNo: { type: String, required: true }, // e.g. POR/25-26/550/1
    subPoSeq: { type: Number, required: true },
    indentId: { type: Schema.Types.ObjectId, ref: 'Indent' },
    indentNo: { type: String },
    vendorLineId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    vendorLineName: { type: String },
    skuCode: { type: String, required: true },
    hsnCode: { type: String },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem' },
    foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    department: { type: String, required: true },
    itemName: { type: String, required: true },
    uom: { type: String, required: true },
    orderedQty: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, default: 0 },
    balanceQty: { type: Number, default: 0 },
    excessQty: { type: Number, default: 0 },
    cancelledQty: { type: Number, default: 0 },
    returnedQty: { type: Number, default: 0 }, // quality returns even after 1 month
    rate: { type: Number, default: 0 },
    discPercent: { type: Number, default: 0 },
    grossValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    cgstRate: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    subtotalValue: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    leadTimeDays: { type: Number, default: 7 },

    // Expected delivery
    expectedDelivery: { type: Date },

    // Stage: Quality/Quantity check
    qqCheckPlanned: { type: Date },
    qqCheckActual: { type: Date },
    qqCheckStatus: { type: String, enum: ['Pending', 'Yes', 'No', 'Failed'], default: 'Pending' },
    qqCheckDelay: { type: String },

    // Stage: Store material
    storePlanned: { type: Date },
    storeActual: { type: Date },
    storeStatus: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },

    // Invoice
    invoiceNo: { type: String },
    invoiceChallanNo: { type: String },
    invoiceDate: { type: Date },
    invoiceSentToHO: { type: Boolean, default: false },
    invoiceSentToHOAt: { type: Date },

    // Accounts
    accountsProcessed: { type: Boolean, default: false },
    accountsProcessedAt: { type: Date },

    status: {
      type: String,
      enum: ['Open', 'Partially Received', 'Fully Received', 'Cancelled', 'Returned', 'Partially Returned'],
      default: 'Open',
    },
  },
  { _id: true }
);

const PurchaseOrderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    // Numbering: POR/25-26/550
    prefix: { type: String, required: true }, // e.g. "POR/25-26"
    poSeqNo: { type: Number, required: true },
    poNo: { type: String, required: true, unique: true }, // full PO number
    qsfNo: { type: String }, // e.g. QSF/PUR/26-27/02, fiscal-year wise reset
    isHO: { type: Boolean, default: false }, // H.O purchase orders

    poDate: { type: Date, required: true, default: Date.now },

    // Vendor
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: { type: String, required: true },
    vendorContact: { type: String },
    vendorKindAttention: { type: String },
    vendorPhone: { type: String },
    vendorGstin: { type: String },
    vendorAddressText: { type: String },
    vendorEmail: { type: String },
    vendorWhatsapp: { type: String },

    // PO terms and tax
    poType: { type: String, enum: ['SGST', 'CGST_SGST'], default: 'CGST_SGST' },
    cgstRate: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    payTerms: { type: String, default: '.' },
    deliveryTerms: { type: String, default: '' },
    shippingMode: { type: String, default: 'ROADWAYS' },
    paymentMethod: { type: String, default: 'NEFT/CHEQUE' },
    deliveryLocation: { type: String, default: 'KOLKATA' },
    amountInWords: { type: String },

    // PO copy document
    poCopyUrl: { type: String },
    poCopyPdfUrl: { type: String },

    // Created by
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String },

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

    // Follow-up stage 1 (2 hrs after PO)
    followUp1Planned: { type: Date },
    followUp1Actual: { type: Date },
    followUp1Status: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },
    followUp1Delay: { type: String },

    // Follow-up stage 2 (7 days before delivery)
    followUp2Planned: { type: Date },
    followUp2Actual: { type: Date },
    followUp2Status: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },
    followUp2Delay: { type: String },

    // Follow-up stage 3 (2 days before delivery)
    followUp3Planned: { type: Date },
    followUp3Actual: { type: Date },
    followUp3Status: { type: String, enum: ['Pending', 'Yes', 'No'], default: 'Pending' },
    followUp3Delay: { type: String },

    subPOs: [SubPOSchema],

    totalItems: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    subtotalValue: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['Draft', 'Issued', 'Partially Received', 'Fully Received', 'Cancelled', 'Closed', 'Returned', 'Partially Returned'],
      default: 'Issued',
      index: true,
    },

    // AI generated flag
    aiGenerated: { type: Boolean, default: false },
    aiPrompt: { type: String },

    remarks: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'purchase_orders' }
);

PurchaseOrderSchema.index({ tenantId: 1, poNo: 1 });
PurchaseOrderSchema.index({ tenantId: 1, status: 1 });
PurchaseOrderSchema.index({ tenantId: 1, vendorId: 1 });
PurchaseOrderSchema.index({ tenantId: 1, poDate: -1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
