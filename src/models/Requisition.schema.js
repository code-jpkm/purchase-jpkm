const mongoose = require('mongoose');
const { Schema } = mongoose;

// Department requisition for outward material from store
const RequisitionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    requisitionNo: { type: String, required: true },
    requisitionDate: { type: Date, default: Date.now },
    lineNo: { type: Number, default: 1 },

    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestorName: { type: String },
    foundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    department: { type: String, required: true },

    skuCode: { type: String, required: true },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    itemName: { type: String, required: true },
    uom: { type: String, required: true },
    requestedQty: { type: Number, required: true, min: 0 },
    issuedQty: { type: Number, default: 0 },
    balanceQty: { type: Number, default: 0 },

    purpose: { type: String },

    // Linked outward
    outwardId: { type: Schema.Types.ObjectId, ref: 'StoreOutward' },

    status: {
      type: String,
      enum: ['Pending', 'Partially Issued', 'Issued', 'Rejected', 'Cancelled'],
      default: 'Pending',
      index: true,
    },

    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, collection: 'requisitions' }
);

RequisitionSchema.index({ tenantId: 1, requisitionNo: 1, lineNo: 1 }, { unique: true });
RequisitionSchema.index({ tenantId: 1, status: 1 });
RequisitionSchema.index({ tenantId: 1, foundry: 1, department: 1 });
RequisitionSchema.index({ tenantId: 1, skuCode: 1 });

module.exports = mongoose.model('Requisition', RequisitionSchema);
