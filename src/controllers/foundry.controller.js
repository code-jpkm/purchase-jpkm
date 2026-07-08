const Foundry = require('../models/Foundry-dept.schema');

// GET /api/store/foundries
const listFoundries = async (req, res) => {
  try {
    const foundries = await Foundry.find({ tenantId: req.tenantId, isDeleted: false }).sort({ name: 1 });
    res.json({ success: true, data: foundries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/foundries/:id
const getFoundry = async (req, res) => {
  try {
    const foundry = await Foundry.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false });
    if (!foundry) return res.status(404).json({ success: false, message: 'Foundry not found' });
    res.json({ success: true, data: foundry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/store/foundries
const createFoundry = async (req, res) => {
  try {
    const existing = await Foundry.findOne({ tenantId: req.tenantId, code: req.body.code?.toUpperCase(), isDeleted: false });
    if (existing) return res.status(400).json({ success: false, message: 'Foundry code already exists' });
    const foundry = await Foundry.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json({ success: true, data: foundry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/store/foundries/:id
const updateFoundry = async (req, res) => {
  try {
    const { departments, ...rest } = req.body;
    const foundry = await Foundry.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, isDeleted: false },
      { $set: rest },
      { new: true, runValidators: true }
    );
    if (!foundry) return res.status(404).json({ success: false, message: 'Foundry not found' });
    res.json({ success: true, data: foundry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/store/foundries/:id (soft)
const deleteFoundry = async (req, res) => {
  try {
    await Foundry.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { isDeleted: true });
    res.json({ success: true, message: 'Foundry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/store/foundries/:id/departments
const addDepartment = async (req, res) => {
  try {
    const foundry = await Foundry.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false });
    if (!foundry) return res.status(404).json({ success: false, message: 'Foundry not found' });

    const dupe = foundry.departments.find(d => d.name.toLowerCase() === req.body.name?.toLowerCase());
    if (dupe) return res.status(400).json({ success: false, message: 'Department already exists in this foundry' });

    foundry.departments.push(req.body);
    await foundry.save();
    res.status(201).json({ success: true, data: foundry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/store/foundries/:id/departments/:deptId
const updateDepartment = async (req, res) => {
  try {
    const foundry = await Foundry.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false });
    if (!foundry) return res.status(404).json({ success: false, message: 'Foundry not found' });

    const dept = foundry.departments.id(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    Object.assign(dept, req.body);
    await foundry.save();
    res.json({ success: true, data: foundry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/store/foundries/:id/departments/:deptId
const deleteDepartment = async (req, res) => {
  try {
    const foundry = await Foundry.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false });
    if (!foundry) return res.status(404).json({ success: false, message: 'Foundry not found' });

    foundry.departments = foundry.departments.filter(d => d._id.toString() !== req.params.deptId);
    await foundry.save();
    res.json({ success: true, data: foundry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/foundries/flat-list — returns [{foundry, department}] pairs for dropdowns
const getFlatList = async (req, res) => {
  try {
    const foundries = await Foundry.find({ tenantId: req.tenantId, isDeleted: false, isActive: true }).sort({ name: 1 });
    const flat = [];
    for (const f of foundries) {
      for (const d of f.departments.filter(d => d.isActive)) {
        flat.push({ foundryId: f._id, foundryName: f.name, foundryCode: f.code, deptId: d._id, deptName: d.name, deptCode: d.code });
      }
    }
    res.json({ success: true, data: foundries, flat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listFoundries, getFoundry, createFoundry, updateFoundry, deleteFoundry, addDepartment, updateDepartment, deleteDepartment, getFlatList };
