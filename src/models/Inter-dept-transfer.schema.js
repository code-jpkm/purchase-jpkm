const mongoose = require('mongoose');
const { Schema } = mongoose;

const InterDeptTransferSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    transferNo: { type: String, required: true, unique: true },
    transferDate: { type: Date, default: Date.now },

    skuCode: { type: String, required: true },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    itemName: { type: String, required: true },
    uom: { type: String, required: true },

    fromFoundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    fromDepartment: { type: String, required: true },
    toFoundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    toDepartment: { type: String, required: true },

    transferQty: { type: Number, required: true, min: 0 },
    reason: { type: String },

    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    initiatedByName: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },

    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Completed', 'Rejected'],
      default: 'Pending',
      index: true,
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, collection: 'inter_dept_transfers' }
);

InterDeptTransferSchema.index({ tenantId: 1, transferDate: -1 });
InterDeptTransferSchema.index({ tenantId: 1, skuCode: 1 });

module.exports = mongoose.model('InterDeptTransfer', InterDeptTransferSchema);
