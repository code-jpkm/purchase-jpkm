const mongoose = require('mongoose');

const tenantMiddleware = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(400).json({ success: false, message: 'Tenant context missing' });
  }
  if (!mongoose.Types.ObjectId.isValid(req.user.tenantId)) {
    return res.status(400).json({ success: false, message: 'Invalid tenant context' });
  }
  req.tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
  next();
};

module.exports = tenantMiddleware;
