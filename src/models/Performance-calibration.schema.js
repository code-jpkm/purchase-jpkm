// performance-calibration.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AdjustmentSchema = new Schema(
  {
    reviewId: { type: Types.ObjectId, ref: 'PerformanceReview', required: true },
    fromScore: { type: Number, required: true },
    toScore: { type: Number, required: true },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const PerformanceCalibrationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cycleId: { type: Types.ObjectId, ref: 'PerformanceCycle', required: true, index: true },
    panelUserIds: [{ type: Types.ObjectId, ref: 'User' }],

    meetingAt: { type: Date },
    adjustments: { type: [AdjustmentSchema], default: [] },

    status: { type: String, enum: ['scheduled', 'in-progress', 'finalized'], default: 'scheduled', index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'performance_calibrations' }
);

PerformanceCalibrationSchema.index({ tenantId: 1, cycleId: 1, status: 1 });

module.exports = mongoose.model('PerformanceCalibration', PerformanceCalibrationSchema);