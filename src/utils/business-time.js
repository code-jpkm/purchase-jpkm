const HolidayCalendar = require('../models/Holiday-calendar.schema');

const WORK_START_HOUR = Number(process.env.WORK_START_HOUR || 9);
const WORK_END_HOUR = Number(process.env.WORK_END_HOUR || 19);
const MS_PER_HOUR = 60 * 60 * 1000;

const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toHolidaySet = (holidays = []) => new Set((holidays || []).map((d) => dateKey(d)));

const isHoliday = (date, holidaySet) => holidaySet.has(dateKey(date));
const isSunday = (date) => new Date(date).getDay() === 0;
const isBusinessDay = (date, holidaySet = new Set()) => !isSunday(date) && !isHoliday(date, holidaySet);

const setTime = (date, hour, minute = 0, second = 0, ms = 0) => {
  const d = new Date(date);
  d.setHours(hour, minute, second, ms);
  return d;
};

const nextBusinessDay = (date, holidaySet = new Set()) => {
  const d = setTime(date, WORK_START_HOUR, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (!isBusinessDay(d, holidaySet)) d.setDate(d.getDate() + 1);
  return d;
};

const normalizeToWorkingTime = (date, holidaySet = new Set()) => {
  let d = new Date(date || Date.now());
  if (!isBusinessDay(d, holidaySet)) {
    d = setTime(d, WORK_START_HOUR, 0, 0, 0);
    while (!isBusinessDay(d, holidaySet)) d.setDate(d.getDate() + 1);
    return d;
  }
  const start = setTime(d, WORK_START_HOUR, 0, 0, 0);
  const end = setTime(d, WORK_END_HOUR, 0, 0, 0);
  if (d < start) return start;
  if (d >= end) return nextBusinessDay(d, holidaySet);
  return d;
};

const addBusinessHours = (date, hours, holidays = []) => {
  const holidaySet = holidays instanceof Set ? holidays : toHolidaySet(holidays);
  let d = normalizeToWorkingTime(date, holidaySet);
  let remainingMs = Math.max(0, Number(hours || 0) * MS_PER_HOUR);
  if (remainingMs === 0) return d;

  while (remainingMs > 0) {
    d = normalizeToWorkingTime(d, holidaySet);
    const end = setTime(d, WORK_END_HOUR, 0, 0, 0);
    const availableMs = Math.max(0, end.getTime() - d.getTime());
    if (remainingMs <= availableMs) return new Date(d.getTime() + remainingMs);
    remainingMs -= availableMs;
    d = nextBusinessDay(d, holidaySet);
  }
  return d;
};

const addTatDays = (date, tatDays, holidays = []) => {
  const tat = Number(tatDays || 0);
  // Google Sheet TAT: fractions are portions of a 24-hour day (0.083333 = 2 hours).
  // Whole numbers are working days, using 9 AM to 7 PM as a 10-hour working day.
  const workingHours = tat > 0 && tat < 1 ? tat * 24 : tat * (WORK_END_HOUR - WORK_START_HOUR);
  return addBusinessHours(date, workingHours, holidays);
};

const nextBusinessDayAt = (date, hour = 10, holidays = []) => {
  const holidaySet = holidays instanceof Set ? holidays : toHolidaySet(holidays);
  let d = new Date(date || Date.now());
  d.setDate(d.getDate() + 1);
  d = setTime(d, hour, 0, 0, 0);
  while (!isBusinessDay(d, holidaySet)) d.setDate(d.getDate() + 1);
  return d;
};

const fetchHolidayDates = async (tenantId) => {
  if (!tenantId) return [];
  const calendars = await HolidayCalendar.find({ tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } }, { holidays: 1 }).lean();
  const dates = [];
  calendars.forEach((cal) => (cal.holidays || []).forEach((h) => h.date && dates.push(h.date)));
  return dates;
};

module.exports = {
  WORK_START_HOUR,
  WORK_END_HOUR,
  dateKey,
  toHolidaySet,
  isBusinessDay,
  normalizeToWorkingTime,
  addBusinessHours,
  addTatDays,
  nextBusinessDayAt,
  fetchHolidayDates,
};
