const jwt = require('jsonwebtoken');

const normalizePermission = (permission) => String(permission || '').trim().toLowerCase().replace('.', ':');

const hasPermission = (user, requiredPermission) => {
  if (!user) return false;
  if (['super_admin', 'admin'].includes(user.role)) return true;
  const required = normalizePermission(requiredPermission);
  const permissions = (user.permissions || []).map(normalizePermission);
  const [moduleName] = required.split(':');
  return permissions.includes(required) || permissions.includes(`${moduleName}:*`) || permissions.includes('*');
};

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.user, permission)) {
    return res.status(403).json({ success: false, message: `Permission required: ${permission}` });
  }
  next();
};

module.exports = { authMiddleware, requireRole, requirePermission, hasPermission };
