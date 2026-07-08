const HelpTicket = require('../models/Help-ticket.schema');
const StoreNotification = require('../models/Notification-store.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const User = require('../models/User.schema');
const { sendEmail, sendWhatsApp } = require('../services/notification.service');

const notifyAdmins = async (req, ticket) => {
  const admins = await User.find({ tenantId: req.tenantId, role: { $in: ['super_admin', 'admin'] }, isDeleted: { $ne: true }, isActive: { $ne: false } }).lean();
  const msg = `🎫 *HELP TICKET RAISED*\n\nTicket: ${ticket.ticketNo}\nModule: ${ticket.module}\nPriority: ${ticket.priority}\nBy: ${ticket.raisedByName}\nSubject: ${ticket.subject}\n\n${ticket.description}`;
  await StoreNotification.create({ tenantId: req.tenantId, type: 'HELP_TICKET', title: `Help ticket: ${ticket.subject}`, message: msg, referenceModel: 'HelpTicket', referenceId: ticket._id, referenceNo: ticket.ticketNo, targetUsers: admins.map((a) => a._id), priority: ticket.priority });
  admins.forEach((a) => { if (a.email) sendEmail({ to: a.email, subject: `Help ticket ${ticket.ticketNo}`, html: `<pre>${msg}</pre>` }); if (a.whatsapp || a.phone) sendWhatsApp(a.whatsapp || a.phone, msg); });
};

const listTickets = async (req, res) => {
  try {
    const query = { tenantId: req.tenantId, isDeleted: { $ne: true } };
    if (!['super_admin', 'admin'].includes(req.user.role)) query.raisedBy = req.user.userId;
    const tickets = await HelpTicket.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, data: tickets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createTicket = async (req, res) => {
  try {
    if (!req.body.subject || !req.body.description) return res.status(400).json({ success: false, message: 'Subject and description are required' });
    const seq = await StoreSequence.nextSeq(req.tenantId, 'HELP_TICKET', new Date().getFullYear(), 'HT');
    const ticketNo = `HT/${new Date().getFullYear()}/${String(seq).padStart(4, '0')}`;
    const ticket = await HelpTicket.create({ tenantId: req.tenantId, ticketNo, subject: req.body.subject, description: req.body.description, module: req.body.module || 'General', priority: req.body.priority || 'MEDIUM', raisedBy: req.user.userId, raisedByName: req.user.name });
    try { await notifyAdmins(req, ticket); } catch (e) { console.error('Help ticket notification failed:', e.message); }
    res.status(201).json({ success: true, data: ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateTicket = async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.status === 'Resolved' && !patch.resolvedAt) patch.resolvedAt = new Date();
    const query = { _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } };
    if (!['super_admin', 'admin'].includes(req.user.role)) query.raisedBy = req.user.userId;
    const ticket = await HelpTicket.findOneAndUpdate(query, patch, { new: true, runValidators: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { listTickets, createTicket, updateTicket };
