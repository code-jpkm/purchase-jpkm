const mongoose = require('mongoose');
const StoreOutward = require('../models/Store-outward.schema');
const Requisition = require('../models/Requisition.schema');
const InterDeptTransfer = require('../models/Inter-dept-transfer.schema');
const StoreSequence = require('../models/Store-sequence.schema');
const StoreItem = require('../models/Store-item.schema');
const { deductStock, transferStock } = require('../services/stock.service');
const { getFiscalYear } = require('../utils/fiscal');

const toReqLines = (body) => {
  if (Array.isArray(body.items) && body.items.length) return body.items;
  return [{ skuCode: body.skuCode, foundry: body.foundry, department: body.department, requestedQty: body.requestedQty || body.requiredQty, purpose: body.purpose }];
};

// POST /api/store/requisitions - supports many items under one requisition number
const createRequisition = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const lines = toReqLines(req.body);
    const first = lines[0] || {};
    const foundry = req.body.foundry || first.foundry;
    const department = req.body.department || first.department;
    if (!foundry || !department) return res.status(400).json({ success: false, message: 'Foundry and department are required' });

    const fy = getFiscalYear();
    const seq = await StoreSequence.nextSeq(tenantId, 'REQUISITION', fy, `REQ/${fy}`);
    const requisitionNo = `REQ/${fy}/${seq}`;
    const docs = [];
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const qtyRequested = Number(line.requestedQty || line.requiredQty || 0);
      const skuCode = line.skuCode;
      if (!skuCode || qtyRequested <= 0) throw new Error(`Line ${idx + 1}: SKU and requested quantity are required`);
      const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true } });
      if (!item) throw new Error(`Line ${idx + 1}: Item not found`);
      docs.push({
        tenantId,
        requisitionNo,
        lineNo: idx + 1,
        requestedBy: req.user.userId,
        requestorName: req.user.name,
        foundry: line.foundry || foundry,
        department: line.department || department,
        skuCode,
        storeItemId: item._id,
        itemName: item.itemName,
        uom: item.uom,
        requestedQty: qtyRequested,
        balanceQty: qtyRequested,
        purpose: line.purpose || req.body.purpose,
      });
    }
    const created = await Requisition.insertMany(docs);
    res.status(201).json({ success: true, data: { requisitionNo, items: created } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/store/requisitions
const listRequisitions = async (req, res) => {
  try {
    const { status, foundry, department, group, page = 1, limit = 30 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false };
    if (status) query.status = status;
    if (foundry) query.foundry = foundry;
    if (department) query.department = { $regex: department, $options: 'i' };

    if (group === 'true') {
      const rows = await Requisition.find(query).sort({ requisitionDate: -1, requisitionNo: -1, lineNo: 1 }).limit(500);
      const grouped = Object.values(rows.reduce((acc, row) => {
        const key = row.requisitionNo;
        if (!acc[key]) acc[key] = { requisitionNo: row.requisitionNo, requisitionDate: row.requisitionDate, foundry: row.foundry, department: row.department, requestorName: row.requestorName, status: row.status, itemCount: 0, items: [] };
        acc[key].itemCount += 1;
        acc[key].items.push(row);
        return acc;
      }, {}));
      return res.json({ success: true, data: grouped, total: grouped.length });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reqs, total] = await Promise.all([
      Requisition.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Requisition.countDocuments(query),
    ]);
    res.json({ success: true, data: reqs, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toOutwardLines = (body) => {
  if (Array.isArray(body.items) && body.items.length) return body.items;
  return [{ requisitionId: body.requisitionId, skuCode: body.skuCode, foundry: body.foundry, department: body.department, issuedQty: body.issuedQty, rate: body.rate }];
};

// POST /api/store/outward — issue material from store; supports one requisition with multiple rows
const createOutward = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenantId = req.tenantId;
    const fy = getFiscalYear();
    const seq = await StoreSequence.nextSeq(tenantId, 'OUTWARD', fy, `OUT/${fy}`);
    const outwardNo = `OUT/${fy}/${seq}`;
    const lines = toOutwardLines(req.body);
    const created = [];

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const skuCode = line.skuCode;
      const toFoundry = line.foundry || line.toFoundry;
      const toDept = line.department || line.toDepartment;
      const qtyIssued = Number(line.issuedQty || 0);
      if (!skuCode || !toFoundry || !toDept || qtyIssued <= 0) throw new Error(`Line ${idx + 1}: SKU, foundry, department and issued quantity are required`);

      const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true } }).session(session);
      if (!item) throw new Error(`Line ${idx + 1}: Item not found: ${skuCode}`);
      await deductStock(tenantId, skuCode, toFoundry, toDept, qtyIssued, session);

      const [outward] = await StoreOutward.create([
        {
          tenantId,
          outwardNo,
          lineNo: idx + 1,
          outwardDate: new Date(),
          outwardType: 'OUTWARD',
          requisitionId: line.requisitionId,
          requisitionNo: line.requisitionNo || req.body.requisitionNo,
          skuCode,
          storeItemId: item._id,
          itemName: item.itemName,
          uom: item.uom,
          fromFoundry: 'STORE',
          fromDepartment: 'STORE',
          toFoundry,
          toDepartment: toDept,
          issuedQty: qtyIssued,
          rate: line.rate || item.rate || 0,
          totalValue: qtyIssued * (line.rate || item.rate || 0),
          issuedBy: req.user.userId,
          issuedByName: req.user.name,
          receivedBy: req.body.receivedBy,
        },
      ], { session });
      created.push(outward);

      if (line.requisitionId) {
        const reqDoc = await Requisition.findOne({ _id: line.requisitionId, tenantId }).session(session);
        if (reqDoc) {
          reqDoc.issuedQty = (reqDoc.issuedQty || 0) + qtyIssued;
          reqDoc.balanceQty = Math.max(0, reqDoc.requestedQty - reqDoc.issuedQty);
          reqDoc.status = reqDoc.balanceQty === 0 ? 'Issued' : 'Partially Issued';
          reqDoc.outwardId = outward._id;
          await reqDoc.save({ session });
        }
      }
    }

    await session.commitTransaction();
    res.status(201).json({ success: true, data: created.length === 1 ? created[0] : created });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/store/outward
const listOutwards = async (req, res) => {
  try {
    const { foundry, department, search, from, to, page = 1, limit = 30 } = req.query;
    const query = { tenantId: req.tenantId, isDeleted: false };
    if (foundry) query.toFoundry = foundry;
    if (department) query.toDepartment = { $regex: department, $options: 'i' };
    if (search) {
      query.$or = [
        { outwardNo: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } },
        { skuCode: { $regex: search, $options: 'i' } },
      ];
    }
    if (from || to) {
      query.outwardDate = {};
      if (from) query.outwardDate.$gte = new Date(from);
      if (to) query.outwardDate.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [outwards, total] = await Promise.all([
      StoreOutward.find(query).sort({ outwardDate: -1, lineNo: 1 }).skip(skip).limit(parseInt(limit)),
      StoreOutward.countDocuments(query),
    ]);
    res.json({ success: true, data: outwards, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/store/inter-dept-transfer
const createIDT = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { skuCode, fromFoundry, fromDepartment, toFoundry, toDepartment, transferQty, reason } = req.body;
    const tenantId = req.tenantId;
    const qtyToTransfer = Number(transferQty || 0);
    if (!skuCode || !fromFoundry || !fromDepartment || !toFoundry || !toDepartment || qtyToTransfer <= 0) throw new Error('SKU, source, destination and transfer quantity are required');

    const fy = getFiscalYear();
    const seq = await StoreSequence.nextSeq(tenantId, 'IDT', fy, `IDT/${fy}`);
    const transferNo = `IDT/${fy}/${seq}`;

    const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true } }).session(session);
    if (!item) throw new Error(`Item not found: ${skuCode}`);

    await transferStock(tenantId, skuCode, fromFoundry, fromDepartment, toFoundry, toDepartment, qtyToTransfer, session);

    const [idt] = await InterDeptTransfer.create([
      {
        tenantId,
        transferNo,
        skuCode,
        storeItemId: item._id,
        itemName: item.itemName,
        uom: item.uom,
        fromFoundry,
        fromDepartment,
        toFoundry,
        toDepartment,
        transferQty: qtyToTransfer,
        reason,
        initiatedBy: req.user.userId,
        initiatedByName: req.user.name,
        status: 'Completed',
      },
    ], { session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: idt });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

module.exports = { createRequisition, listRequisitions, createOutward, listOutwards, createIDT };
