// travel-request.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SegmentSchema = new Schema(
  {
    type: { type: String, enum: ['flight', 'train', 'cab', 'hotel'], required: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const TravelRequestSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    policyId: { type: Types.ObjectId, ref: 'TravelPolicy', index: true },

    purpose: { type: String, required: true, trim: true },
    segments: { type: [SegmentSchema], default: [] },

    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'booked', 'completed', 'cancelled'], default: 'submitted', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },
  },
  { timestamps: true, versionKey: false, collection: 'travel_requests' }
);

TravelRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
module.exports = mongoose.model('TravelRequest', TravelRequestSchema);