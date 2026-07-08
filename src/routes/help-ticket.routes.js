const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/help-ticket.controller');
// Any logged-in user can raise/view own tickets. Admin sees all tickets.
router.get('/', ctrl.listTickets);
router.post('/', ctrl.createTicket);
router.put('/:id', ctrl.updateTicket);
module.exports = router;
