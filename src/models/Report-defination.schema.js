// report-definition.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ReportDefinitionSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    entityType: { type: String, required: true }, // e.g., 'DailyAttendance'
    columns: [{ type: String, required: true }],  // field paths
    filters: Schema.Types.Mixed, // JSON conditions
    sort: Schema.Types.Mixed,    // { field: 1/-1 }

    visualType: { type: String, enum: ['table', 'chart-bar', 'chart-line', 'chart-pie'], default: 'table' },
    chartConfig: Schema.Types.Mixed,

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: 'report_definitions' }
);

ReportDefinitionSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ReportDefinition', ReportDefinitionSchema);