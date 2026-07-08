const StoreItem = require('../models/Store-item.schema');
const StoreNotification = require('../models/Notification-store.schema');
const { sendEmail, sendWhatsApp, buildLowStockMessage } = require('./notification.service');
const logger = require('../utils/logger');
const { classifyStock, getHistoricalDailyAverage } = require('../utils/inventory-health');
const { getStockEntry } = require('../utils/inventory-query');

// Add stock when GRN is confirmed (QC passed)
const addStock = async (tenantId, skuCode, foundry, department, qty, session = null) => {
  const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true } }).session(session || null);
  if (!item) throw new Error(`Item not found: ${skuCode}`);

  let stockEntry = getStockEntry(item, foundry, department);
  if (stockEntry) {
    stockEntry.currentQty = (stockEntry.currentQty || 0) + Number(qty || 0);
  } else {
    item.stocks.push({ foundry, department, currentQty: Number(qty || 0), currentSeason: 'Normal' });
    stockEntry = getStockEntry(item, foundry, department);
  }
  item.recalcTotal();
  await item.save(session ? { session } : {});

  if (stockEntry?.maxLevel && stockEntry.currentQty > stockEntry.maxLevel) {
    logger.info(`Over-stock: ${skuCode} ${foundry}/${department} qty ${stockEntry.currentQty} > max ${stockEntry.maxLevel}`);
  }

  return item;
};

// Deduct stock on outward or material return
const deductStock = async (tenantId, skuCode, foundry, department, qty, session = null) => {
  const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true } }).session(session || null);
  if (!item) throw new Error(`Item not found: ${skuCode}`);

  const stockEntry = getStockEntry(item, foundry, department);
  const requestedQty = Number(qty || 0);
  if (!stockEntry || (stockEntry.currentQty || 0) < requestedQty) {
    throw new Error(`Insufficient stock for ${skuCode} at ${foundry}/${department}: available ${stockEntry?.currentQty || 0}, requested ${requestedQty}`);
  }

  stockEntry.currentQty -= requestedQty;
  item.recalcTotal();
  await item.save(session ? { session } : {});

  await checkAndNotifyLowStock(tenantId, item, stockEntry);
  return item;
};

// Transfer between departments
const transferStock = async (tenantId, skuCode, fromFoundry, fromDept, toFoundry, toDept, qty, session = null) => {
  const item = await StoreItem.findOne({ tenantId, skuCode, isDeleted: { $ne: true } }).session(session || null);
  if (!item) throw new Error(`Item not found: ${skuCode}`);

  const requestedQty = Number(qty || 0);
  const fromEntry = getStockEntry(item, fromFoundry, fromDept);
  if (!fromEntry || (fromEntry.currentQty || 0) < requestedQty) {
    throw new Error(`Insufficient stock in ${fromFoundry}/${fromDept}`);
  }

  fromEntry.currentQty -= requestedQty;
  let toEntry = getStockEntry(item, toFoundry, toDept);
  if (toEntry) {
    toEntry.currentQty = (toEntry.currentQty || 0) + requestedQty;
  } else {
    item.stocks.push({ foundry: toFoundry, department: toDept, currentQty: requestedQty, currentSeason: 'Normal' });
    toEntry = getStockEntry(item, toFoundry, toDept);
  }
  item.recalcTotal();
  await item.save(session ? { session } : {});

  await checkAndNotifyLowStock(tenantId, item, fromEntry);
  return item;
};

const checkAndNotifyLowStock = async (tenantId, item, stockEntry) => {
  try {
    const currentQty = stockEntry?.currentQty || 0;
    const hist = await getHistoricalDailyAverage(tenantId, item.skuCode, stockEntry?.foundry, stockEntry?.department, 90);
    const health = classifyStock(stockEntry, hist);
    const isLow = health.status === 'LOW';
    const isZero = health.status === 'ZERO';

    if (!isLow && !isZero) return;

    const type = isZero ? 'ZERO_STOCK' : 'LOW_STOCK';
    const title = isZero ? `Zero Stock: ${item.itemName}` : `Low Stock: ${item.itemName}`;
    const message = `${buildLowStockMessage(item, currentQty, stockEntry?.foundry, stockEntry?.department)}\nSeason: ${health.currentSeason}\nHistoric Avg: ${health.historicalDailyAverage}/day\nReorder Level: ${health.reorderLevel}`;

    await StoreNotification.create({
      tenantId,
      type,
      title,
      message,
      referenceModel: 'StoreItem',
      referenceId: item._id,
      referenceNo: item.skuCode,
      priority: isZero ? 'CRITICAL' : 'HIGH',
    });

    const alertConfig = process.env.LOW_STOCK_ALERT_EMAILS;
    const alertWhatsapp = process.env.LOW_STOCK_ALERT_WHATSAPP;

    if (alertConfig) {
      await sendEmail({
        to: alertConfig.split(',').map((v) => v.trim()).filter(Boolean),
        subject: title,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      });
    }
    if (alertWhatsapp) {
      await Promise.all(alertWhatsapp.split(',').map((p) => sendWhatsApp(p.trim(), message)));
    }
  } catch (err) {
    logger.error(`Low stock notification error: ${err.message}`);
  }
};

module.exports = { addStock, deductStock, transferStock, checkAndNotifyLowStock };
