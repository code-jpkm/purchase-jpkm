// Fiscal year helpers (April-March cycle for India)
const getFiscalYear = (date = new Date()) => {
  const yr = date.getFullYear();
  const mo = date.getMonth() + 1; // 1-12
  const startYear = mo >= 4 ? yr : yr - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(2)}-${String(endYear).slice(2)}`; // "25-26"
};

const getFiscalYearFull = (date = new Date()) => {
  const yr = date.getFullYear();
  const mo = date.getMonth() + 1;
  const startYear = mo >= 4 ? yr : yr - 1;
  return `${startYear}-${startYear + 1}`; // "2025-2026"
};

const getMonthLabel = (year, month) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]}-${year}`;
};

const getPeriodDates = (year, month) => {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0); // last day of month
  return { periodStart, periodEnd };
};

module.exports = { getFiscalYear, getFiscalYearFull, getMonthLabel, getPeriodDates };
