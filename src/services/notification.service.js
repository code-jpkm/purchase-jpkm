const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../utils/logger');

// Email transporter
let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: `"JPK Factory Store" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`Email error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// Maytapi WhatsApp
const sendWhatsApp = async (phone, message) => {
  try {
    const productId = process.env.MAYTAPI_PRODUCT_ID;
    const phoneId = process.env.MAYTAPI_PHONE_ID;
    const token = process.env.MAYTAPI_TOKEN;

    if (!productId || !phoneId || !token) {
      logger.warn('Maytapi credentials not configured');
      return { success: false, error: 'Maytapi not configured' };
    }

    // Clean phone number — ensure country code prefix
    const cleanPhone = phone.replace(/\D/g, '');
    const formatted = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    const res = await axios.post(
      `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`,
      { to_number: formatted, type: 'text', message },
      {
        headers: {
          'x-maytapi-key': token,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    logger.info(`WhatsApp sent to ${formatted}`);
    return { success: true, data: res.data };
  } catch (err) {
    logger.error(`WhatsApp error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

const sendBulkWhatsApp = async (phones, message) => {
  const results = await Promise.allSettled(phones.map((p) => sendWhatsApp(p, message)));
  return results;
};

// Build notification messages
const buildLowStockMessage = (item, stock, foundry, department) =>
  `⚠️ *LOW STOCK ALERT*\n\nItem: ${item.itemName}\nSKU: ${item.skuCode}\nLocation: ${foundry || '-'} / ${department || '-'}\nCurrent Qty: ${stock} ${item.uom}\n\nPlease arrange for immediate purchase.\n\n_JPK Factory Store System_`;

const buildBudgetAlertMessage = (dept, item, budgeted, actual, variance) => {
  const alertType = variance > 0 ? 'BUDGET OVERRUN ALERT' : 'BUDGET UNDERRUN ALERT';
  return `🚨 *${alertType}*\n\nDepartment: ${dept}\nItem: ${item}\nBudget: ₹${budgeted.toLocaleString('en-IN')}\nActual: ₹${actual.toLocaleString('en-IN')}\nVariance: ${variance > 0 ? '+' : ''}${variance.toFixed(2)}%\n\n_JPK Factory Store System_`;
};

const buildPOAlertMessage = (poNo, vendor, items, value) =>
  `📦 *PURCHASE ORDER ISSUED*\n\nPO No: ${poNo}\nVendor: ${vendor}\nItems: ${items}\nTotal Value: ₹${value.toLocaleString('en-IN')}\n\n_JPK Factory Store System_`;

const buildGRNMessage = (poNo, itemName, qty, uom) =>
  `✅ *MATERIAL RECEIVED*\n\nPO No: ${poNo}\nItem: ${itemName}\nQty Received: ${qty} ${uom}\n\n_JPK Factory Store System_`;

module.exports = {
  sendEmail,
  sendWhatsApp,
  sendBulkWhatsApp,
  buildLowStockMessage,
  buildBudgetAlertMessage,
  buildPOAlertMessage,
  buildGRNMessage,
};
