const StoreOutward = require('../models/Store-outward.schema');

const seasonAverageField = (season) => {
  const normalized = String(season || 'Normal').toLowerCase();
  if (normalized === 'low') return 'dailyAvgConsumptionLow';
  if (normalized === 'peak') return 'dailyAvgConsumptionPeak';
  return 'dailyAvgConsumptionNormal';
};

const getConfiguredDailyAverage = (stock) => {
  const field = seasonAverageField(stock?.currentSeason);
  return Number(stock?.[field] || stock?.dailyAvgConsumptionNormal || stock?.dailyAvgConsumptionLow || stock?.dailyAvgConsumptionPeak || 0);
};

const getHistoricalDailyAverage = async (tenantId, skuCode, foundry, department, days = 90) => {
  const since = new Date(Date.now() - Number(days || 90) * 24 * 60 * 60 * 1000);
  const match = {
    tenantId,
    skuCode,
    isDeleted: false,
    outwardDate: { $gte: since },
  };
  if (foundry) match.toFoundry = foundry;
  if (department) match.toDepartment = department;

  const [row] = await StoreOutward.aggregate([
    { $match: match },
    { $group: { _id: null, qty: { $sum: '$issuedQty' }, count: { $sum: 1 } } },
  ]);
  return row ? Number(row.qty || 0) / Number(days || 90) : 0;
};

const classifyStock = (stock, historicalDailyAverage = 0) => {
  const currentQty = Number(stock?.currentQty || 0);
  const currentSeason = stock?.currentSeason || 'Normal';
  const configuredDailyAvg = getConfiguredDailyAverage(stock);
  const dailyAverage = Math.max(configuredDailyAvg, Number(historicalDailyAverage || 0));
  const leadTime = Number(stock?.leadTime || 0);
  const safetyFactor = Number(stock?.safetyFactor || 1);
  const maxLevel = Number(stock?.maxLevel || (dailyAverage * leadTime * safetyFactor));
  const reorderLevel = Math.max(0, dailyAverage * leadTime * safetyFactor);
  const lowLine = reorderLevel || maxLevel * 0.25;
  const mediumLine = maxLevel ? maxLevel * 0.5 : lowLine * 1.5;

  let status = 'IN RANGE';
  let severity = 'success';
  let message = 'Stock is within the required range';

  if (currentQty <= 0) {
    status = 'ZERO';
    severity = 'danger';
    message = 'No stock available';
  } else if (lowLine > 0 && currentQty <= lowLine) {
    status = 'LOW';
    severity = 'danger';
    message = `Below reorder level ${Number(lowLine.toFixed(2))}`;
  } else if (mediumLine > 0 && currentQty <= mediumLine) {
    status = 'MEDIUM';
    severity = 'warning';
    message = 'Stock is available but should be watched';
  } else if (maxLevel > 0 && currentQty > maxLevel) {
    status = 'HIGH';
    severity = 'info';
    message = `Above max level ${Number(maxLevel.toFixed(2))}`;
  }

  return {
    status,
    severity,
    message,
    currentSeason,
    currentQty,
    dailyAverage: Number(dailyAverage.toFixed(3)),
    configuredDailyAvg: Number(configuredDailyAvg.toFixed(3)),
    historicalDailyAverage: Number(Number(historicalDailyAverage || 0).toFixed(3)),
    leadTime,
    safetyFactor,
    reorderLevel: Number(lowLine.toFixed(2)),
    maxLevel: Number(maxLevel.toFixed(2)),
    lowConsumption: Number(stock?.dailyAvgConsumptionLow || 0),
    normalConsumption: Number(stock?.dailyAvgConsumptionNormal || 0),
    peakConsumption: Number(stock?.dailyAvgConsumptionPeak || 0),
  };
};

module.exports = { classifyStock, getHistoricalDailyAverage, getConfiguredDailyAverage };
