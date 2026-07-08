const Uom = require('../models/Uom.schema');
const MotherItem = require('../models/Mother-item.schema');
const StoreItem = require('../models/Store-item.schema');

const sanitizeCode = (value) => String(value || '').trim().toUpperCase();

const listUoms = async (req, res) => {
  try {
    const uoms = await Uom.find({ tenantId: req.tenantId, isDeleted: { $ne: true } }).sort({ code: 1 }).lean();
    res.json({ success: true, data: uoms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createUom = async (req, res) => {
  try {
    const code = sanitizeCode(req.body.code || req.body.name);
    if (!code) return res.status(400).json({ success: false, message: 'UOM code is required' });
    const uom = await Uom.findOneAndUpdate(
      { tenantId: req.tenantId, code },
      { tenantId: req.tenantId, code, name: req.body.name || code, description: req.body.description || '', isActive: req.body.isActive !== false, isDeleted: false },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json({ success: true, data: uom });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateUom = async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.code) patch.code = sanitizeCode(patch.code);
    const uom = await Uom.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } }, patch, { new: true, runValidators: true });
    if (!uom) return res.status(404).json({ success: false, message: 'UOM not found' });
    res.json({ success: true, data: uom });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteUom = async (req, res) => {
  try {
    await Uom.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { isDeleted: true, isActive: false });
    res.json({ success: true, message: 'UOM deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const listMotherItems = async (req, res) => {
  try {
    const items = await MotherItem.find({ tenantId: req.tenantId, isDeleted: { $ne: true } }).sort({ itemType: 1, name: 1 }).lean();
    const liveStats = await StoreItem.aggregate([
      { $match: { tenantId: req.tenantObjectId || req.tenantId, isDeleted: { $ne: true }, isActive: { $ne: false } } },
      { $group: { _id: { itemType: '$itemType', motherItem: '$motherItem' }, childCount: { $sum: 1 }, totalQty: { $sum: '$totalAvailableQty' }, avgRate: { $avg: '$rate' } } },
    ]).catch(() => []);
    const statMap = new Map(liveStats.map((s) => [`${s._id.itemType}|${String(s._id.motherItem || '').toUpperCase()}`, s]));
    const data = items.map((m) => {
      const s = statMap.get(`${m.itemType}|${m.name}`) || {};
      return { ...m, childCount: s.childCount || 0, totalQty: s.totalQty || 0, avgRate: Math.round((s.avgRate || 0) * 100) / 100 };
    });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createMotherItem = async (req, res) => {
  try {
    const name = sanitizeCode(req.body.name);
    if (!name) return res.status(400).json({ success: false, message: 'Mother item name is required' });
    const item = await MotherItem.findOneAndUpdate(
      { tenantId: req.tenantId, name },
      { tenantId: req.tenantId, name, itemType: req.body.itemType || 'Stores', description: req.body.description || '', isActive: req.body.isActive !== false, isDeleted: false },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateMotherItem = async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.name) patch.name = sanitizeCode(patch.name);
    const item = await MotherItem.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId, isDeleted: { $ne: true } }, patch, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Mother item not found' });
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteMotherItem = async (req, res) => {
  try {
    await MotherItem.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { isDeleted: true, isActive: false });
    res.json({ success: true, message: 'Mother item deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { listUoms, createUom, updateUom, deleteUom, listMotherItems, createMotherItem, updateMotherItem, deleteMotherItem };
