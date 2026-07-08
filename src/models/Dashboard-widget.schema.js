// dashboard-widget.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Configurable dashboard widgets (metrics/charts/tables) with role-based visibility.
 */
const DashboardWidgetSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', index: true },

    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    type: { type: String, enum: ['metric', 'chart-line', 'chart-bar', 'chart-pie', 'table', 'list'], default: 'metric' },
    dataSource: {
      entityType: { type: String, trim: true }, // or custom query key
      query: Schema.Types.Mixed, // filters/aggregation pipeline
      refreshSeconds: { type: Number, default: 300 },
    },

    layout: {
      w: { type: Number, default: 4 }, // grid width
      h: { type: Number, default: 3 }, // grid height
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },

    visibleToRoleIds: [{ type: Types.ObjectId, ref: 'Role' }],
    visibleToUserIds: [{ type: Types.ObjectId, ref: 'User' }],

    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false, collection: 'dashboard_widgets' }
);

DashboardWidgetSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('DashboardWidget', DashboardWidgetSchema);