const StoreNotification = require('../models/Notification-store.schema');

const listNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 50, unreadOnly } = req.query;
    const query = { tenantId: req.tenantId };
    if (unreadOnly === 'true') query.readBy = { $ne: req.user.userId };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total, unread] = await Promise.all([
      StoreNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      StoreNotification.countDocuments(query),
      StoreNotification.countDocuments({ tenantId: req.tenantId, readBy: { $ne: req.user.userId } }),
    ]);
    res.json({ success: true, data: rows, total, unread });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const markRead = async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await StoreNotification.updateMany({ tenantId: req.tenantId, readBy: { $ne: req.user.userId } }, { $addToSet: { readBy: req.user.userId } });
      return res.json({ success: true });
    }
    await StoreNotification.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { $addToSet: { readBy: req.user.userId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { listNotifications, markRead };
