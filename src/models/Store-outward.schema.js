const mongoose = require('mongoose');
const { Schema } = mongoose;

// Material issued from store to department
const StoreOutwardSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    outwardNo: { type: String, required: true },
    outwardDate: { type: Date, default: Date.now },
    lineNo: { type: Number, default: 1 },
    outwardType: { type: String, enum: ['OUTWARD', 'INTER_DEPT_TRANSFER'], default: 'OUTWARD' },

    // Source
    requisitionId: { type: Schema.Types.ObjectId, ref: 'Requisition' },
    requisitionNo: { type: String },

    // Item
    skuCode: { type: String, required: true },
    storeItemId: { type: Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    itemName: { type: String, required: true },
    uom: { type: String, required: true },

    // From
    fromFoundry: { type: String, enum: ['D. I', 'C. I', 'STORE'], default: 'STORE' },
    fromDepartment: { type: String, default: 'STORE' },

    // To
    toFoundry: { type: String, enum: ['D. I', 'C. I'], required: true },
    toDepartment: { type: String, required: true },

    issuedQty: { type: Number, required: true, min: 0 },
    rate: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },

    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    issuedByName: { type: String },
    receivedBy: { type: String }, // department person name

    remarks: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'store_outwards' }
);

StoreOutwardSchema.index({ tenantId: 1, outwardNo: 1, lineNo: 1 }, { unique: true });
StoreOutwardSchema.index({ tenantId: 1, outwardDate: -1 });
StoreOutwardSchema.index({ tenantId: 1, skuCode: 1 });
StoreOutwardSchema.index({ tenantId: 1, toFoundry: 1, toDepartment: 1 });

module.exports = mongoose.model('StoreOutward', StoreOutwardSchema);
