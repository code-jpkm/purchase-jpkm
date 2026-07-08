// timesheet-entry.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const TimesheetEntrySchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },

    employeeId: { type: Types.ObjectId, ref: 'EmployeeProfile', required: true, index: true },
    date: { type: Date, required: true, index: true },

    projectId: { type: Types.ObjectId, ref: 'Project', required: true, index: true },
    taskId: { type: Types.ObjectId, ref: 'ProjectTask' },
    hours: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },

    billable: { type: Boolean, default: false },
    hourlyRate: { type: Number }, // snapshot from rate-card
    amount: { type: Number },     // computed

    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'locked'], default: 'submitted', index: true },
    workflowInstanceId: { type: Types.ObjectId, ref: 'WorkflowInstance' },

    locked: { type: Boolean, default: false, index: true },
    payrollPeriodId: { type: Types.ObjectId, ref: 'PayrollPeriod' }, // if used for OT integration
  },
  { timestamps: true, versionKey: false, collection: 'timesheet_entries' }
);

TimesheetEntrySchema.index({ tenantId: 1, employeeId: 1, date: 1, projectId: 1 });

module.exports = mongoose.model('TimesheetEntry', TimesheetEntrySchema);