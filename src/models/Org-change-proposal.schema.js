// org-change-proposal.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const OrgChangeProposalSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    changes: Schema.Types.Mixed, // e.g., JSON: { moveEmployees: [...], mergeDepartments: [...] }
    impactSummary: Schema.Types.Mixed,

    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'applied'], default: 'draft', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
  },
  { timestamps: true, versionKey: false, collection: 'org_change_proposals' }
);

OrgChangeProposalSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
module.exports = mongoose.model('OrgChangeProposal', OrgChangeProposalSchema);