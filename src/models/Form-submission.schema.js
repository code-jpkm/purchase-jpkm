// form-submission.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const FormSubmissionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    formId: { type: Types.ObjectId, ref: 'CustomForm', required: true, index: true },
    entityRef: {
      type: { type: String }, // e.g., 'EmployeeProfile'
      id: { type: Types.ObjectId },
    },
    submittedByUserId: { type: Types.ObjectId, ref: 'User' },

    data: Schema.Types.Mixed, // key/value per schema
    attachments: { type: [String], default: [] },

    status: { type: String, enum: ['submitted', 'approved', 'rejected'], default: 'submitted', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
  },
  { timestamps: true, versionKey: false, collection: 'form_submissions' }
);

FormSubmissionSchema.index({ tenantId: 1, formId: 1, 'entityRef.type': 1, 'entityRef.id': 1 });

module.exports = mongoose.model('FormSubmission', FormSubmissionSchema);