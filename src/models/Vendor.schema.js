const mongoose = require('mongoose');
const { Schema } = mongoose;

const VendorSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendorCode: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    kindAttention: { type: String, trim: true }, // printed as Kind Attn. in PO PDF
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    gstNo: { type: String, trim: true, uppercase: true },
    panNo: { type: String, trim: true, uppercase: true },
    bankDetails: {
      bankName: String,
      accountNo: String,
      ifsc: String,
      accountHolder: String,
    },
    paymentTerms: { type: String, default: '30 days' },
    avgLeadTimeDays: { type: Number, default: 7 },
    rating: { type: Number, min: 1, max: 5, default: 3 },
    categories: [{ type: String }], // what they supply
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'vendors' }
);

VendorSchema.index({ tenantId: 1, vendorCode: 1 }, { unique: true });
VendorSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Vendor', VendorSchema);
