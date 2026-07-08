const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const {
  listHolidayCalendars,
  createHolidayCalendar,
  updateHolidayCalendar,
  deleteHolidayCalendar,
  addHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holiday.controller');

router.get('/', requirePermission('holiday:read'), listHolidayCalendars);
router.post('/', requirePermission('holiday:write'), createHolidayCalendar);
router.put('/:id', requirePermission('holiday:write'), updateHolidayCalendar);
router.delete('/:id', requirePermission('holiday:write'), deleteHolidayCalendar);
router.post('/:id/holidays', requirePermission('holiday:write'), addHoliday);
router.put('/:id/holidays/:index', requirePermission('holiday:write'), updateHoliday);
router.delete('/:id/holidays/:index', requirePermission('holiday:write'), deleteHoliday);

module.exports = router;
