const bcrypt = require('bcryptjs');
const User = require('../models/User.schema');
const StoreNotification = require('../models/Notification-store.schema');
const { sendEmail, sendWhatsApp } = require('../services/notification.service');

const ALL_PERMISSIONS = [
  'store:read', 'store:write',
  'indent:read', 'indent:write',
  'purchase:read', 'purchase:write',
  'grn:read', 'grn:write',
  'outward:read', 'outward:write',
  'budget:read', 'budget:write',
  'stock_statement:read', 'stock_statement:write',
  'vendor:read', 'vendor:write',
  'foundry:read', 'foundry:write',
  'holiday:read', 'holiday:write',
  'fms:read', 'fms:admin',
  'help:read', 'help:write',
  'user:read', 'user:write',
  'ai:use', 'costing:read', 'costing:write',
];


const normalizeUserScope = (payload = {}) => {
  const out = { ...payload };
  if (Object.prototype.hasOwnProperty.call(out, 'foundry')) {
    out.foundry = out.foundry === '' || out.foundry === undefined ? null : out.foundry;
  }
  if (Object.prototype.hasOwnProperty.call(out, 'department')) {
    out.department = out.department === '' || out.department === undefined ? null : out.department;
  }
  if (Array.isArray(out.permissions)) {
    out.permissions = out.permissions.filter(Boolean);
  }
  return out;
};

const roleDefaults = {
  super_admin: ['*'],
  admin: ['*'],
  store_manager: ['store:*', 'indent:*', 'grn:*', 'outward:*', 'stock_statement:read', 'vendor:read', 'fms:read', 'help:*', 'ai:use', 'costing:read'],
  purchase_manager: ['store:read', 'indent:read', 'purchase:*', 'vendor:*', 'grn:read', 'fms:read', 'help:*', 'ai:use', 'costing:read'],
  accounts: ['stock_statement:*', 'budget:*', 'grn:read', 'purchase:read', 'fms:read', 'help:*'],
  department_user: ['store:read', 'indent:*', 'outward:*', 'budget:read', 'budget:write', 'fms:read', 'help:*'],
  viewer: ['store:read', 'indent:read', 'purchase:read', 'grn:read', 'outward:read', 'dashboard:read', 'help:read', 'help:write'],
};

const listUsers = async (req, res) => {
  try {
    const users = await User.find({ tenantId: req.tenantId, isDeleted: { $ne: true } }, '-passwordHash').sort({ name: 1 }).lean();
    res.json({ success: true, data: users, permissions: ALL_PERMISSIONS, roleDefaults });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createUser = async (req, res) => {
  try {
    const body = normalizeUserScope(req.body);
    const { name, email, phone, whatsapp, password, role = 'viewer', permissions, foundry, department } = body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      tenantId: req.tenantId,
      name,
      email: String(email).toLowerCase().trim(),
      phone,
      whatsapp,
      passwordHash,
      role,
      permissions: Array.isArray(permissions) ? permissions : (roleDefaults[role] || []),
      foundry: foundry || null,
      department,
      isActive: true,
    });
    const msg = `👤 *JPK IMS USER CREATED*\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\n\nPlease login to JPK IMS and change your password if needed.`;
    await StoreNotification.create({ tenantId: req.tenantId, type: 'USER_CREATED', title: `User created: ${name}`, message: msg, referenceModel: 'User', referenceId: user._id, referenceNo: email, targetUsers: [user._id], priority: 'MEDIUM' });
    if (email) sendEmail({ to: email, subject: 'Your JPK IMS login has been created', html: `<pre>${msg}</pre>` });
    if (whatsapp || phone) sendWhatsApp(whatsapp || phone, msg);
    const safe = user.toObject(); delete safe.passwordHash;
    res.status(201).json({ success: true, data: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateUser = async (req, res) => {
  try {
    const payload = normalizeUserScope(req.body);
    delete payload.password;
    if (req.body.password) payload.passwordHash = await bcrypt.hash(req.body.password, 10);
    if (payload.email) payload.email = String(payload.email).toLowerCase().trim();
    const user = await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } }, payload, { new: true, runValidators: true }).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    delete user.passwordHash;
    res.json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteUser = async (req, res) => {
  try {
    await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { isDeleted: true, isActive: false, deletedAt: new Date() });
    res.json({ success: true, message: 'User disabled' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { listUsers, createUser, updateUser, deleteUser, ALL_PERMISSIONS, roleDefaults };
