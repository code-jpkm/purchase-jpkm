// performance-cycle.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PerformanceCycleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['planned', 'active', 'calibration', 'closed'], default: 'planned', index: true },
    description: { type: String, trim: true },

    scopes: {
      locations: [{ type: Types.ObjectId, ref: 'Location' }],
      departments: [{ type: Types.ObjectId, ref: 'Department' }],
      designations: [{ type: Types.ObjectId, ref: 'Designation' }],
    },

    kpiLibraryId: { type: Types.ObjectId }, // if using a central KPI library
    reviewTemplateId: { type: Types.ObjectId, ref: 'PerformanceReviewTemplate' },

    isActive: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false, collection: 'performance_cycles' }
);

PerformanceCycleSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('PerformanceCycle', PerformanceCycleSchema);