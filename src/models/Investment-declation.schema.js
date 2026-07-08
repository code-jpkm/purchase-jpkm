// investment-declaration.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DeclarationItemSchema = new Schema(
  {
    sectionCode: { type: String, required: true, trim: true }, // e.g., 80C, 80D
    subSection: { type: String, trim: true }, // e.g., LIC, PPF
    declaredAmount: { type: Number, required: true, default: 0 },
    approvedAmount: { type: Number, default: 0 },
    proofUrls: { type: [String], default: [] },
    status: { type: String, enum: ['declared', 'approved', 'rejected', 'partial'], default: 'declared' },
    reviewerComment: { type: String, trim: true },
  },
  { _id: false }
);

const InvestmentDeclarationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },

    items: { type: [DeclarationItemSchema], default: [] },
    locked: { type: Boolean, default: false, index: true },
    reviewedByUserId: { type: Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },

    notes: { type: String, trim: true }
  },
  { timestamps: true, versionKey: false, collection: 'investment_declarations' }
);

InvestmentDeclarationSchema.index({ tenantId: 1, employeeId: 1, fiscalYear: 1 }, { unique: true });

module.exports = mongoose.model('InvestmentDeclaration', InvestmentDeclarationSchema);