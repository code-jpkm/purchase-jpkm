const HolidayCalendar = require('../models/Holiday-calendar.schema');

const cleanCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
const yearNow = () => new Date().getFullYear();

const normalizeHoliday = (body = {}) => {
  if (!body.date) throw new Error('Holiday date is required');
  if (!body.name) throw new Error('Holiday name is required');
  return {
    date: new Date(body.date),
    name: String(body.name || '').trim(),
    type: body.type || 'company',
    isPaid: body.isPaid !== false,
    halfDay: !!body.halfDay,
    notes: body.notes || '',
  };
};

const calendarQuery = (req, extra = {}) => ({ tenantId: req.tenantId, isDeleted: { $ne: true }, ...extra });

const listHolidayCalendars = async (req, res) => {
  try {
    const year = Number(req.query.year || 0);
    const query = calendarQuery(req);
    if (year) query.$or = [{ year }, { isRecurringAnnual: true }];

    const calendars = await HolidayCalendar.find(query).sort({ year: -1, name: 1 }).lean();
    const holidays = [];
    calendars.forEach((calendar) => {
      (calendar.holidays || []).forEach((holiday, index) => {
        holidays.push({ ...holiday, index, calendarId: calendar._id, calendarName: calendar.name, calendarCode: calendar.code, calendarYear: calendar.year });
      });
    });
    holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ success: true, data: calendars, holidays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createHolidayCalendar = async (req, res) => {
  try {
    const payload = {
      tenantId: req.tenantId,
      name: String(req.body.name || `Factory Holidays ${req.body.year || yearNow()}`).trim(),
      code: cleanCode(req.body.code || `HOL_${req.body.year || yearNow()}`),
      year: Number(req.body.year || yearNow()),
      isRecurringAnnual: !!req.body.isRecurringAnnual,
      isActive: req.body.isActive !== false,
      holidays: Array.isArray(req.body.holidays) ? req.body.holidays.map(normalizeHoliday) : [],
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    };

    const calendar = await HolidayCalendar.findOneAndUpdate(
      { tenantId: req.tenantId, code: payload.code, year: payload.year },
      { $setOnInsert: payload, $set: { name: payload.name, isRecurringAnnual: payload.isRecurringAnnual, isActive: payload.isActive, isDeleted: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({ success: true, data: calendar });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateHolidayCalendar = async (req, res) => {
  try {
    const update = {};
    ['name', 'year', 'isRecurringAnnual', 'isActive', 'tags'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    if (req.body.code !== undefined) update.code = cleanCode(req.body.code);
    if (req.body.holidays !== undefined && Array.isArray(req.body.holidays)) update.holidays = req.body.holidays.map(normalizeHoliday);

    const calendar = await HolidayCalendar.findOneAndUpdate(calendarQuery(req, { _id: req.params.id }), update, { new: true, runValidators: true });
    if (!calendar) return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    res.json({ success: true, data: calendar });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteHolidayCalendar = async (req, res) => {
  try {
    const calendar = await HolidayCalendar.findOneAndUpdate(calendarQuery(req, { _id: req.params.id }), { isDeleted: true, deletedAt: new Date() }, { new: true });
    if (!calendar) return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    res.json({ success: true, message: 'Holiday calendar deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addHoliday = async (req, res) => {
  try {
    const entry = normalizeHoliday(req.body);
    const calendar = await HolidayCalendar.findOne(calendarQuery(req, { _id: req.params.id }));
    if (!calendar) return res.status(404).json({ success: false, message: 'Holiday calendar not found' });

    const incomingKey = entry.date.toISOString().slice(0, 10);
    const existingIndex = calendar.holidays.findIndex((h) => new Date(h.date).toISOString().slice(0, 10) === incomingKey);
    if (existingIndex >= 0) calendar.holidays[existingIndex] = entry;
    else calendar.holidays.push(entry);
    calendar.holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    await calendar.save();
    res.status(201).json({ success: true, data: calendar });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateHoliday = async (req, res) => {
  try {
    const index = Number(req.params.index);
    const entry = normalizeHoliday(req.body);
    const calendar = await HolidayCalendar.findOne(calendarQuery(req, { _id: req.params.id }));
    if (!calendar) return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    if (!calendar.holidays[index]) return res.status(404).json({ success: false, message: 'Holiday not found' });
    calendar.holidays[index] = entry;
    calendar.holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    await calendar.save();
    res.json({ success: true, data: calendar });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const index = Number(req.params.index);
    const calendar = await HolidayCalendar.findOne(calendarQuery(req, { _id: req.params.id }));
    if (!calendar) return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    if (!calendar.holidays[index]) return res.status(404).json({ success: false, message: 'Holiday not found' });
    calendar.holidays.splice(index, 1);
    await calendar.save();
    res.json({ success: true, data: calendar });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  listHolidayCalendars,
  createHolidayCalendar,
  updateHolidayCalendar,
  deleteHolidayCalendar,
  addHoliday,
  updateHoliday,
  deleteHoliday,
};
