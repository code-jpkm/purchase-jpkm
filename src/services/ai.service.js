const axios = require('axios');
const logger = require('../utils/logger');

const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';

const safeJson = (value) => JSON.stringify(value, (key, val) => {
  if (key === 'passwordHash') return undefined;
  return val;
});

const callGemini = async (prompt, systemInstruction = '') => {
  const key = apiKey();
  if (!key) throw new Error('GEMINI_API_KEY is not configured. Add it in backend/.env to enable Gemini AI.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const { data } = await axios.post(url, {
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.25, maxOutputTokens: 4096 },
  }, { timeout: 30000 });
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim() || '';
};

const generatePOFromPrompt = async (prompt, context) => {
  const systemPrompt = `You are an AI assistant for JPK Factory's Purchase & Store Management System.
You help create Purchase Orders based on user instructions.
Return ONLY valid JSON in this format:
{
  "vendorName": "...",
  "vendorId": "...",
  "items": [{ "skuCode": "...", "itemName": "...", "foundry": "D. I or C. I", "department": "...", "orderedQty": 0, "uom": "...", "rate": 0, "totalValue": 0, "leadTimeDays": 7 }],
  "totalValue": 0,
  "remarks": "...",
  "missingInfo": []
}`;
  const contextPrompt = `Context available:\nItems: ${safeJson(context.items?.slice(0, 50) || [])}\nVendors: ${safeJson(context.vendors?.slice(0, 25) || [])}\n\nUser request: ${prompt}`;
  try {
    const text = await callGemini(contextPrompt, systemPrompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');
    return { success: true, data: JSON.parse(jsonMatch[0]) };
  } catch (err) {
    logger.error(`Gemini PO generation error: ${err.message}`);
    return { success: false, error: err.message, data: { vendorName: '', items: [], totalValue: 0, remarks: prompt, missingInfo: [err.message] } };
  }
};

const chatWithStoreAI = async (messages, context) => {
  const systemPrompt = `You are JPK Factory's senior costing, purchase and store AI assistant for a ductile iron/cast iron foundry.
Act like a real ERP copilot: use the live IMS context, identify risk, give exact next actions, and mention records/POs/vendors/items whenever available.
You can analyze: stock urgency, FIFO material cost, budget vs actual, vendor delay/debit note performance, FMS overdue tasks, month-end costing, partial receipts, and replacement vendor suggestions.
Never give generic answers. Structure replies with: 1) finding, 2) reason/data, 3) action needed, 4) who should act. Today: ${new Date().toLocaleDateString('en-IN')}`;
  try {
    const history = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const text = await callGemini(`${context ? `Context: ${safeJson(context)}\n\n` : ''}${history}`, systemPrompt);
    return { success: true, reply: text };
  } catch (err) {
    logger.error(`Gemini chat error: ${err.message}`);
    return { success: false, reply: `Gemini error: ${err.message}` };
  }
};

module.exports = { generatePOFromPrompt, chatWithStoreAI };
