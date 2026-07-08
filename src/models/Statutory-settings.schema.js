// statutory-settings.schema.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Tenant-wide statutory configurations for PF, ESI, PT, TDS, LWF.
 */
const PTStateSlabSchema = new Schema(
  {
    state: { type: String, required: true, trim: true, uppercase: true }, // e.g., KA, MH
    slabs: [
      {
        minGross: { type: Number, required: true },
        maxGross: { type: Number }, // null for open-ended
        amount: { type: Number, required: true },
        monthsApplicable: { type: [Number], default: [1,2,3,4,5,6,7,8,9,10,11,12] }, // 1..12
      },
    ],
  },
  { _id: false }
);

const TDSSlabSchema = new Schema(
  {
    regime: { type: String, enum: ['old', 'new'], required: true },
    slabs: [
      {
        upTo: { type: Number, required: true },
        ratePercent: { type: Number, required: true },
      },
    ],
    surcharge: [
      {
        threshold: { type: Number, required: true },
        ratePercent: { type: Number, required: true },
      },
    ],
    cessPercent: { type: Number, default: 4 }, // health & education cess
    standardDeductionAnnual: { type: Number, default: 50000 },
  },
  { _id: false }
);

const StatutorySettingsSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },

    pf: {
      enabled: { type: Boolean, default: true },
      employeeRatePercent: { type: Number, default: 12 },
      employerRatePercent: { type: Number, default: 12 },
      wageCeilingMonthly: { type: Number, default: 15000 }, // PF wage ceiling
      restrictToBasicDA: { type: Boolean, default: true },
      roundToNearest: { type: Number, default: 1 },
    },

    esi: {
      enabled: { type: Boolean, default: true },
      employeeRatePercent: { type: Number, default: 0.75 },
      employerRatePercent: { type: Number, default: 3.25 },
      grossCeilingMonthly: { type: Number, default: 21000 },
      roundToNearest: { type: Number, default: 1 },
    },

    pt: {
      enabled: { type: Boolean, default: true },
      states: { type: [PTStateSlabSchema], default: [] },
      defaultState: { type: String, trim: true, uppercase: true },
    },

    lwf: {
      enabled: { type: Boolean, default: false },
      employeeAmount: { type: Number, default: 0 },
      employerAmount: { type: Number, default: 0 },
      monthsApplicable: { type: [Number], default: [] },
      state: { type: String, trim: true, uppercase: true },
    },

    tds: {
      enabled: { type: Boolean, default: true },
      slabs: { type: [TDSSlabSchema], default: [] },
      defaultRegime: { type: String, enum: ['old', 'new'], default: 'new' },
    },

    challanDefaults: {
      tan: { type: String, trim: true, uppercase: true },
      pfEstablishmentCode: { type: String, trim: true },
      esiEmployerCode: { type: String, trim: true },
      ptOfficeLocation: { type: String, trim: true },
    }
  },
  { timestamps: true, versionKey: false, collection: 'statutory_settings' }
);

module.exports = mongoose.model('StatutorySettings', StatutorySettingsSchema);