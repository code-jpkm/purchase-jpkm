const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.schema');
const Tenant = require('../models/Tenant.schema');

const buildTokenPayload = (user) => ({
  userId: user._id,
  tenantId: user.tenantId?._id || user.tenantId,
  tenantCode: user.tenantId?.code,
  tenantName: user.tenantId?.name,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions: user.permissions || [],
  foundry: user.foundry,
  department: user.department,
});

const publicUser = (user) => ({
  id: user._id,
  tenantId: user.tenantId?._id || user.tenantId,
  tenantCode: user.tenantId?.code,
  tenantName: user.tenantId?.name,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions: user.permissions || [],
  foundry: user.foundry,
  department: user.department,
});

const signAccessToken = (payload) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
};

const login = async (req, res) => {
  try {
    const { email, password, tenantCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const query = { email: normalizedEmail, isDeleted: { $ne: true }, isActive: true };

    if (tenantCode) {
      const tenant = await Tenant.findOne({ code: String(tenantCode).trim().toUpperCase(), status: 'active', isDeleted: { $ne: true } });
      if (!tenant) return res.status(401).json({ success: false, message: 'Invalid tenant or credentials' });
      query.tenantId = tenant._id;
    }

    const user = await User.findOne(query).populate('tenantId');
    if (!user || !user.tenantId || user.tenantId.status !== 'active' || user.tenantId.isDeleted === true) {
      return res.status(401).json({ success: false, message: 'Invalid tenant or credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash || '');
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid tenant or credentials' });

    user.lastLoginAt = new Date();
    user.lastSeenAt = new Date();
    user.isOnline = true;
    await user.save();

    const payload = buildTokenPayload(user);
    const token = signAccessToken(payload);

    res.json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId, tenantId: decoded.tenantId, isDeleted: { $ne: true }, isActive: true }).populate('tenantId');
    if (!user || !user.tenantId || user.tenantId.status !== 'active' || user.tenantId.isDeleted === true) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const newToken = signAccessToken(buildTokenPayload(user));
    res.json({ success: true, token: newToken, user: publicUser(user) });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { login, refreshToken };
