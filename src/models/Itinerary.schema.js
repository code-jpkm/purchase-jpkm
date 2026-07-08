// itinerary.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const LegSchema = new Schema(
  {
    provider: { type: String, trim: true },
    pnr: { type: String, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ItinerarySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    travelRequestId: { type: Types.ObjectId, ref: 'TravelRequest', required: true, index: true },
    legs: { type: [LegSchema], default: [] },
    ticketsUrl: { type: String, trim: true },
    bookingsUrl: { type: String, trim: true },
    status: { type: String, enum: ['booked', 'changed', 'cancelled', 'completed'], default: 'booked', index: true },
  },
  { timestamps: true, versionKey: false, collection: 'itineraries' }
);

ItinerarySchema.index({ tenantId: 1, travelRequestId: 1 }, { unique: true });
module.exports = mongoose.model('Itinerary', ItinerarySchema);