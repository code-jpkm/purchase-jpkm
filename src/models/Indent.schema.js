const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sequence helper is managed by backend service
const IndentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    // Numbering: JPKM/ IND/ 25-26 / 537
    prefix: { type: String, required: true }, // e.g. "JPKM/ IND/ 25 -26"
    seqNo: { type: Number, required: true },
    indentNo: { type: String, required: true }, // full formatted group number
    isHO: { type: Boolean, default: false }, // Head Office indent (H.O series)
    lineNo: { type: Number, default: 1 },
    indentDate: { type: Date, required: true },

    // Requestor
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestorName: { type: String },

    // Item details
    skuCode: { type: String, required: true },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    department: { type: String, required: true },
    itemName: { type: String, required: true },
    uom: { type: String, required: true },
    requiredQty: { type: Number, required: true, min: 0 },
    stockPosition: { type: Number, default: 0 }, // stock at time of indent

    // Document
    uploadedIndentCopyUrl: { type: String },

    // Workflow timestamps
    submittedAt: { type: Date, default: Date.now },
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

    // Stage 1: Store acknowledgement
    storeAckPlanned: { type: Date },
    storeAckActual: { type: Date },
    storeAckStatus: { type: String, enum: ['Pending', 'Yes', 'No', 'Delayed'], default: 'Pending' },
    storeAckDelay: { type: String }, // HH:MM:SS

    // Stage 2: PO generation planned
    poPlanned: { type: Date },
    poActual: { type: Date },
    poStatus: { type: String, enum: ['Pending', 'Yes', 'No', 'Delayed'], default: 'Pending' },

    // Overall status
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Acknowledged', 'PO Created', 'Partially Received', 'Fully Received', 'Returned', 'Partially Returned', 'Cancelled'],
      default: 'Submitted',
      index: true,
    },

    // Linked PO
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    poNo: { type: String },

    remarks: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'indents' }
);

IndentSchema.index({ tenantId: 1, indentNo: 1, lineNo: 1 }, { unique: true });
IndentSchema.index({ tenantId: 1, status: 1 });
IndentSchema.index({ tenantId: 1, skuCode: 1 });
IndentSchema.index({ tenantId: 1, foundry: 1, department: 1 });
IndentSchema.index({ tenantId: 1, indentDate: -1 });

module.exports = mongoose.model('Indent', IndentSchema);
