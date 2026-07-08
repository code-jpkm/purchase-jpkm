// workflow.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Defines approval workflows reusable across entities (leave, expense, roster, payroll, salary change, etc).
 */

const EscalationSchema = new Schema(
  {
    afterHours: { type: Number, required: true }, // escalate if not acted
    toRoleId: { type: Types.ObjectId, ref: 'Role' },
    toManagerLevelsUp: { type: Number }, // escalate up the chain
    notifyOnly: { type: Boolean, default: false }, // true => reminder without moving approver
  },
  { _id: false }
);

const AutoActionSchema = new Schema(
  {
    // e.g., auto-approve if amount <= X, or balance sufficient, etc.
    conditionExpr: { type: String, trim: true }, // DSL evaluated at runtime
    action: { type: String, enum: ['approve', 'reject', 'skip-step'], required: true },
  },
  { _id: false }
);

const StepSchema = new Schema(
  {
    order: { type: Number, required: true },
    approverType: {
      type: String,
      required: true,
      enum: ['role', 'manager', 'specific-user', 'group'],
    },
    roleId: { type: Types.ObjectId, ref: 'Role' },
    managerLevel: { type: Number, min: 0 }, // 0=direct manager
    userId: { type: Types.ObjectId, ref: 'User' },
    groupRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],

    anyOneCanApprove: { type: Boolean, default: true },
    requireAllApprovals: { type: Boolean, default: false },

    slaHours: { type: Number, default: 48 },
    escalations: { type: [EscalationSchema], default: [] },

    autoActions: { type: [AutoActionSchema], default: [] },
    allowDelegate: { type: Boolean, default: true },
    allowComments: { type: Boolean, default: true },

    rejectBehavior: { type: String, enum: ['send-back', 'terminate'], default: 'terminate' },
  },
  { _id: false }
);

const WorkflowSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    entityTypes: {
      type: [String],
      required: true,
      // Examples: 'leave', 'expense', 'salary-structure', 'roster', 'overtime', 'encashment', 'separation', 'payslip-publish'
    },
    description: { type: String, trim: true },

    steps: { type: [StepSchema], default: [], validate: v => Array.isArray(v) && v.length > 0 },

    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date }, // null=open-ended
    isActive: { type: Boolean, default: true, index: true },

    // Optional defaulting by scope
    scopes: {
      locations: [{ type: Types.ObjectId, ref: 'Location' }],
      departments: [{ type: Types.ObjectId, ref: 'Department' }],
      designations: [{ type: Types.ObjectId, ref: 'Designation' }],
    },

    tags: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, collection: 'workflows' }
);

WorkflowSchema.index({ tenantId: 1, code: 1 }, { unique: true });
WorkflowSchema.index({ tenantId: 1, isActive: 1, effectiveFrom: 1 });

module.exports = mongoose.model('Workflow', WorkflowSchema);