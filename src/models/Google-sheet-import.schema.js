const mongoose = require('mongoose');
const { Schema } = mongoose;

const GoogleSheetImportSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String, trim: true },
    targetSection: { type: String, required: true, trim: true, index: true },
    spreadsheetId: { type: String, required: true, trim: true },
    spreadsheetUrl: { type: String, trim: true },
    sheetName: { type: String, trim: true },
    range: { type: String, trim: true },
    headerRow: { type: Number },
    dateColumn: { type: String, trim: true },
    fromDate: { type: Date },
    toDate: { type: Date },
    detectedHeaders: [{ type: String }],
    mappedHeaders: Schema.Types.Mixed,
    missingHeaders: [{ type: String }],
    importedRows: { type: Number, default: 0 },
    summary: Schema.Types.Mixed,
    status: { type: String, enum: ['Previewed', 'Imported', 'Failed'], default: 'Previewed', index: true },
    error: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false, collection: 'google_sheet_imports' }
);

GoogleSheetImportSchema.index({ tenantId: 1, createdAt: -1 });
module.exports = mongoose.model('GoogleSheetImport', GoogleSheetImportSchema);
