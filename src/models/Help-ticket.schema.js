
const mongoose = require('mongoose');
const { Schema } = mongoose;

const HelpTicketSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  ticketNo: { type: String, required: true, index: true },
  subject: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  module: { type: String, trim: true, default: 'General' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open', index: true },
  raisedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  raisedByName: { type: String, trim: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedToName: { type: String, trim: true },
  resolution: { type: String, trim: true },
  resolvedAt: { type: Date },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: 'help_tickets' });

HelpTicketSchema.index({ tenantId: 1, ticketNo: 1 }, { unique: true });
module.exports = mongoose.model('HelpTicket', HelpTicketSchema);
