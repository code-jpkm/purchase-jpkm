const Vendor = require('../models/Vendor.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const { getFiscalYear } = require('../utils/fiscal');

const createVendor = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const fy = getFiscalYear();
    const seq = await StoreSequence.nextSeq(tenantId, 'VENDOR', fy, 'VEN');
    const vendorCode = req.body.vendorCode || `VEN-${String(seq).padStart(4, '0')}`;
    const vendor = await Vendor.create({ ...req.body, tenantId, vendorCode });
    res.status(201).json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listVendors = async (req, res) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { vendorCode: { $regex: search, $options: 'i' } },
        { gstNo: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [vendors, total] = await Promise.all([
      Vendor.find(query).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
      Vendor.countDocuments(query),
    ]);
    res.json({ success: true, data: vendors, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    await Vendor.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { isDeleted: true });
    res.json({ success: true, message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createVendor, listVendors, getVendor, updateVendor, deleteVendor };
