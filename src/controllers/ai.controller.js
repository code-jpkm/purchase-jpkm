const mongoose = require('mongoose');
const { generatePOFromPrompt, chatWithStoreAI } = require('../services/ai.service');
const StoreItem = require('../models/Store-item.schema');
const Vendor = require('../models/Vendor.schema');
const Budget = require('../models/Budget.schema');
const PurchaseOrder = require('../models/Purchase-order.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const StoreOutward = require('../models/Store-outward.schema');
const UserTask = require('../models/User-task.schema');
const AIConversation = require('../models/AI-conversation.schema');

const aiGeneratePO = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: 'Prompt required' });
    const [items, vendors] = await Promise.all([
      StoreItem.find({ tenantId: req.tenantId, isDeleted: false, isActive: true }, { skuCode: 1, itemName: 1, uom: 1, rate: 1, lastVendorName: 1, totalAvailableQty: 1 }).limit(250),
      Vendor.find({ tenantId: req.tenantId, isDeleted: false, isActive: true }, { _id: 1, name: 1, vendorCode: 1, email: 1, phone: 1, avgLeadTimeDays: 1 }).limit(100),
    ]);
    const result = await generatePOFromPrompt(prompt, { items, vendors });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const buildLiveContext = async (tenantId) => {
  const tenantObjectId = tenantId instanceof mongoose.Types.ObjectId ? tenantId : new mongoose.Types.ObjectId(String(tenantId));
  const [inventorySummary, zeroStock, overdueTasks, recentPOs, receipts, vendorPerformance] = await Promise.all([
    StoreItem.aggregate([{ $match: { tenantId: tenantObjectId, isDeleted: false } }, { $group: { _id: '$itemType', count: { $sum: 1 }, zeroStock: { $sum: { $cond: [{ $eq: ['$totalAvailableQty', 0] }, 1, 0] } }, totalValue: { $sum: { $multiply: ['$totalAvailableQty', '$rate'] } } } }]),
    StoreItem.find({ tenantId, isDeleted: false, totalAvailableQty: { $lte: 0 } }, 'skuCode itemName itemType motherItem totalAvailableQty rate').limit(40).lean(),
    UserTask.find({ tenantId, isDeleted: false, status: 'Pending', plannedAt: { $lte: new Date() } }, 'referenceNo stepWhat userName plannedAt fmsType priority').sort({ plannedAt: 1 }).limit(30).lean(),
    PurchaseOrder.find({ tenantId, isDeleted: false }, 'poNo vendorName status totalValue poDate subPOs').sort({ poDate: -1 }).limit(20).lean(),
    GoodsReceipt.find({ tenantId, isDeleted: false }, 'poNo vendorName itemDescription deliveryStatus deliveryDelayDays noteType noteValue actualReceiptDate').sort({ actualReceiptDate: -1 }).limit(40).lean(),
    GoodsReceipt.aggregate([{ $match: { tenantId: tenantObjectId, isDeleted: false } }, { $group: { _id: '$vendorName', receipts: { $sum: 1 }, delayed: { $sum: { $cond: [{ $gt: ['$deliveryDelayDays', 0] }, 1, 0] } }, debitNotes: { $sum: { $cond: [{ $eq: ['$noteType', 'Debit Note'] }, 1, 0] } }, debitValue: { $sum: { $cond: [{ $eq: ['$noteType', 'Debit Note'] }, '$noteValue', 0] } } } }, { $sort: { delayed: -1, debitNotes: -1 } }, { $limit: 20 }]),
  ]);
  const now = new Date();
  const currentMonth = now.getMonth() + 1; const year = now.getFullYear();
  const [budgets, outwards] = await Promise.all([
    Budget.find({ tenantId, year, month: currentMonth, isDeleted: false }).limit(50).lean(),
    StoreOutward.aggregate([{ $match: { tenantId: tenantObjectId, isDeleted: false, outwardDate: { $gte: new Date(year, currentMonth - 1, 1), $lt: new Date(year, currentMonth, 1) } } }, { $group: { _id: { foundry: '$toFoundry', department: '$toDepartment' }, totalValue: { $sum: '$totalValue' }, lines: { $sum: 1 } } }]),
  ]);
  return { inventorySummary, zeroStock, overdueTasks, recentPOs, receipts, vendorPerformance, budgets, monthConsumption: outwards, today: now.toLocaleDateString('en-IN') };
};

const aiChat = async (req, res) => {
  try {
    const { messages, contextType, conversationId } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ success: false, message: 'Messages array required' });
    const context = await buildLiveContext(req.tenantId);
    const result = await chatWithStoreAI(messages, context);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || 'New question';
    const conv = await AIConversation.findOneAndUpdate(
      { _id: conversationId || new mongoose.Types.ObjectId(), tenantId: req.tenantId, userId: req.user.userId, isDeleted: false },
      { tenantId: req.tenantId, userId: req.user.userId, title: String(lastUser).slice(0, 80), messages: [...messages, { role: 'assistant', content: result.reply }].map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt || new Date() })) },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: { ...result, conversationId: conv._id } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const listConversations = async (req, res) => {
  const query = { tenantId: req.tenantId, isDeleted: false };
  if (!['admin', 'super_admin'].includes(req.user.role)) query.userId = req.user.userId;
  const data = await AIConversation.find(query, 'title updatedAt userId').sort({ updatedAt: -1 }).limit(50).lean();
  res.json({ success: true, data });
};
const getConversation = async (req, res) => {
  const query = { _id: req.params.id, tenantId: req.tenantId, isDeleted: false };
  if (!['admin', 'super_admin'].includes(req.user.role)) query.userId = req.user.userId;
  const data = await AIConversation.findOne(query).lean();
  if (!data) return res.status(404).json({ success: false, message: 'Conversation not found' });
  res.json({ success: true, data });
};
const deleteConversation = async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only admin can delete AI conversations' });
  await AIConversation.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { isDeleted: true });
  res.json({ success: true });
};

module.exports = { aiGeneratePO, aiChat, listConversations, getConversation, deleteConversation };
