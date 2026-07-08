const XLSX = require('xlsx');
const CostingRun = require('../models/Costing-run.schema');
const FloorMaterialBalance = require('../models/Floor-material-balance.schema');
const StoreOutward = require('../models/Store-outward.schema');
const StoreItem = require('../models/Store-item.schema');
const GoodsReceipt = require('../models/Goods-receipt.schema');
const StoreNotification = require('../models/Notification-store.schema');
const { sendEmail, sendWhatsApp } = require('../services/notification.service');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ITEM_TYPES = ['Raw Material', 'Chemical', 'Packing Material', 'Hard Coke', 'Paint', 'Stores', 'Grinding Wheel', 'Fire Wood', 'Lime Stone', 'Repair'];
const SECTION_RULES = [
  { section: 'RAW MATERIAL', words: ['PIG IRON','BORING','PIPE CUTTING','SCRAP','FOUNDORY RETURN','FOUNDRY RETURN','HARD COKE','LIME STONE'] },
  { section: 'FERRO ALLOYES', words: ['FERRO','FESIMG','FE-SI','INOCULANT','CARBON RAISER','SLAG','ANTIMONY','GRAPHITE GRANULES'] },
  { section: 'TESTING', words: ['ARGAN','ARGON','CARBON CUP','PAPER','TEMP','CADTIDGE','CARTRIDGE','A4'] },
  { section: 'REFRACTORY', words: ['RAMMING','CEMENT','CEMNT','FIRE CLAY','LINING','WHYTHEAT'] },
  { section: 'MOULDING', words: ['BENTONITE','SAND','RESIN','SODIUM','GRAPHITE POWDER','GRAFCOAT','MSEAL','K.OIL','LPG','OXYGEN','HAND GLOV','BELCHA','CHALNA','BROAD NAIL','HALPATI','CORE PASTE','FEVI'] },
  { section: 'FETTLING, FINISHING', words: ['CUTTER','WHEEL','BRUSH','PAINT','THINNER','STRAPPING','PALLET','BOLT','ARMATURE','HYDROLIC','HYDRAULIC','PUTTY','GRINDING'] },
];

const manualDefaults = (type = 'GREEN_SAND') => [
  { section: 'FURNACE & POWER', source: 'MANUAL', itemName: 'Power / Electricity Cost', uom: 'UNIT', notes: 'Manual monthly electricity cost' },
  { section: 'LABOUR PAYMENT', source: 'MANUAL', itemName: 'Labour Pay (Lenka)', uom: 'RS', notes: 'Manual labour amount' },
  { section: 'LABOUR PAYMENT', source: 'MANUAL', itemName: 'Fettling Pay', uom: 'RS', notes: 'Manual fettling amount' },
  { section: 'OTHERS', source: 'MANUAL', itemName: 'Security', uom: 'RS' },
  { section: 'OTHERS', source: 'MANUAL', itemName: 'Forklift & Diesel', uom: 'RS' },
  { section: 'OTHERS', source: 'MANUAL', itemName: 'Stores & A/C', uom: 'RS' },
  { section: 'OTHERS', source: 'MANUAL', itemName: 'Maintenance A/C', uom: 'RS' },
  { section: 'STAFF SALARY', source: 'MANUAL', itemName: 'Staff Salary (Factory)', uom: 'RS' },
  { section: 'STAFF SALARY', source: 'MANUAL', itemName: 'Staff Bonus & Leave', uom: 'RS' },
  { section: 'STAFF SALARY H.O', source: 'MANUAL', itemName: 'Staff Salary (Head Office)', uom: 'RS' },
  { section: 'STATUTORY', source: 'MANUAL', itemName: 'Employer PF / ESI Contribution', uom: 'RS' },
  { section: 'ENGG. EQUIPMENT', source: 'MANUAL', itemName: 'AMC', uom: 'RS' },
  { section: 'ENGG. EQUIPMENT', source: 'MANUAL', itemName: 'Calibration', uom: 'RS' },
  { section: 'ENGG. EQUIPMENT', source: 'MANUAL', itemName: 'Service Charge', uom: 'RS' },
  { section: 'OVERHEAD', source: 'MANUAL', itemName: 'Internet / Communication', uom: 'RS' },
  { section: 'OVERHEAD', source: 'MANUAL', itemName: 'Miscellaneous - specify in notes', uom: 'RS' },
];

const monthRange = (year, month) => ({ start: new Date(year, month - 1, 1), end: new Date(year, month, 1) });
const titleType = (type) => type === 'NO_BAKE' ? 'NOBAKE COSTING' : 'GREEN SAND COSTING';
const sectionForItem = (item = {}) => {
  const hay = `${item.itemName || ''} ${item.motherItem || ''} ${item.itemType || ''}`.toUpperCase();
  for (const rule of SECTION_RULES) if (rule.words.some((w) => hay.includes(w))) return rule.section;
  if (String(item.itemType).toLowerCase().includes('packing')) return 'FETTLING, FINISHING';
  if (String(item.itemType).toLowerCase().includes('grinding')) return 'FETTLING, FINISHING';
  if (String(item.itemType).toLowerCase().includes('chemical')) return 'MOULDING';
  return 'STORES CONSUMABLES';
};

const getFifoRate = async (tenantId, skuCode, qty, uptoDate, fallbackRate = 0) => {
  if (!qty) return Number(fallbackRate || 0);
  const receipts = await GoodsReceipt.find({ tenantId, skuCode, isDeleted: false, stockAdded: true, actualReceiptDate: { $lte: uptoDate } }).sort({ actualReceiptDate: 1 }).lean();
  let remaining = Number(qty || 0);
  let amount = 0;
  for (const r of receipts) {
    const available = Math.max(0, Number(r.receivedQty || 0) - Number(r.returnedQty || 0));
    if (!available) continue;
    const take = Math.min(remaining, available);
    amount += take * Number(r.rate || fallbackRate || 0);
    remaining -= take;
    if (remaining <= 0) break;
  }
  if (remaining > 0) amount += remaining * Number(fallbackRate || 0);
  return amount / Number(qty || 1);
};

const buildStoreLines = async (tenantId, year, month, foundry, department, goodCastingWtMt) => {
  const { start, end } = monthRange(year, month);
  const outwards = await StoreOutward.aggregate([
    { $match: { tenantId, isDeleted: false, outwardDate: { $gte: start, $lt: end }, toFoundry: foundry, ...(department ? { toDepartment: department } : {}) } },
    { $group: { _id: '$skuCode', outwardQty: { $sum: '$issuedQty' }, value: { $sum: '$totalValue' } } },
  ]);
  const lines = [];
  for (const row of outwards) {
    const item = await StoreItem.findOne({ tenantId, skuCode: row._id, isDeleted: false }).lean();
    if (!item || item.itemType === 'Capital') continue;
    if (!ITEM_TYPES.includes(item.itemType)) continue;
    const floor = await FloorMaterialBalance.findOne({ tenantId, year, month, skuCode: row._id, foundry, ...(department ? { department } : {}) }).lean();
    const floorLeftQty = Number(floor?.floorLeftQty || 0);
    const consumedQty = Math.max(0, Number(row.outwardQty || 0) - floorLeftQty);
    const rate = await getFifoRate(tenantId, row._id, consumedQty, end, item.rate || 0);
    const totalAmount = consumedQty * rate;
    lines.push({
      section: sectionForItem(item), source: 'STORE', itemType: item.itemType, motherItem: item.motherItem, skuCode: item.skuCode,
      itemName: item.itemName, uom: item.uom, rate, outwardQty: row.outwardQty, floorLeftQty, consumedQty, totalAmount,
      costPerTon: goodCastingWtMt ? totalAmount / goodCastingWtMt : 0,
      costPerKg: goodCastingWtMt ? totalAmount / (goodCastingWtMt * 1000) : 0,
      consumptionPercent: row.outwardQty ? consumedQty / row.outwardQty * 100 : 0,
    });
  }
  return lines;
};

const recalcRunTotals = (run) => {
  const good = Number(run.goodCastingWtMt || 0);
  const allLines = [...(run.lines || []), ...(run.manualLines || [])];
  const production = allLines.reduce((s, l) => s + Number(l.totalAmount || 0), 0);
  const sales = Number(production) + (run.salesLines || []).reduce((s, l) => s + Number(l.totalAmount || 0), 0);
  const material = allLines.filter((l) => ['RAW MATERIAL','FERRO ALLOYES','TESTING','REFRACTORY','MOULDING','FETTLING, FINISHING','STORES CONSUMABLES'].includes(l.section)).reduce((s,l)=>s+Number(l.totalAmount||0),0);
  const power = allLines.filter((l) => String(l.section).includes('POWER')).reduce((s,l)=>s+Number(l.totalAmount||0),0);
  run.costOfProduction = production;
  run.costOfSales = sales;
  run.materialCostPerKg = good ? material / (good * 1000) : 0;
  run.powerCostPerKg = good ? power / (good * 1000) : 0;
  run.conversionCostPerKg = good ? (production - material - power) / (good * 1000) : 0;
  run.totalInputCostPerTon = good ? production / good : 0;
  run.totalInputCostPerKg = good ? production / (good * 1000) : 0;
  [...(run.lines || []), ...(run.manualLines || []), ...(run.salesLines || [])].forEach((l) => {
    l.costPerTon = good ? Number(l.totalAmount || 0) / good : 0;
    l.costPerKg = good ? Number(l.totalAmount || 0) / (good * 1000) : 0;
  });
  return run;
};

const listCostings = async (req, res) => {
  try {
    const data = await CostingRun.find({ tenantId: req.tenantId, isDeleted: false }).sort({ year: -1, month: -1, costingType: 1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getCosting = async (req, res) => {
  try {
    const run = await CostingRun.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted: false }).lean();
    if (!run) return res.status(404).json({ success: false, message: 'Costing not found' });
    res.json({ success: true, data: run });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const saveFloorBalance = async (req, res) => {
  try {
    const { year, month, foundry, department, lines = [] } = req.body;
    const saved = [];
    for (const line of lines) {
      if (!line.skuCode) continue;
      const item = await StoreItem.findOne({ tenantId: req.tenantId, skuCode: line.skuCode, isDeleted: false }).lean();
      const doc = await FloorMaterialBalance.findOneAndUpdate(
        { tenantId: req.tenantId, year, month, foundry, department, skuCode: line.skuCode },
        { tenantId: req.tenantId, year, month, foundry, department, skuCode: line.skuCode, itemName: item?.itemName || line.itemName, itemType: item?.itemType || line.itemType, motherItem: item?.motherItem || line.motherItem, uom: item?.uom || line.uom, floorLeftQty: Number(line.floorLeftQty || 0), countedBy: req.user.userId, countedByName: req.user.name, countedAt: new Date(), remarks: line.remarks, isDeleted: false },
        { upsert: true, new: true, runValidators: true }
      );
      saved.push(doc);
    }
    res.json({ success: true, data: saved });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const generateCosting = async (req, res) => {
  try {
    const { year, month, costingType = 'GREEN_SAND', foundry = 'D. I', department = '', totalWorkingDays = 0, totalHeats = 0, liquidMetalMt = 0, productionWtMt = 0, rejectionWtMt = 0, goodCastingWtMt = 0, noBakeProductionMt = 0, manualLines = [], salesLines = [], remarks = '' } = req.body;
    if (!year || !month || !goodCastingWtMt) return res.status(400).json({ success: false, message: 'Year, month and good casting weight are required' });
    const costingNo = `${costingType}/${year}/${String(month).padStart(2,'0')}`;
    const storeLines = await buildStoreLines(req.tenantId, Number(year), Number(month), foundry, department, Number(goodCastingWtMt));
    const normalizedManual = (manualLines.length ? manualLines : manualDefaults(costingType)).map((l) => {
      const qty = Number(l.consumedQty || l.qty || 1);
      const rate = Number(l.rate || 0);
      const totalAmount = Number(l.totalAmount || (qty * rate) || 0);
      return { ...l, source: 'MANUAL', consumedQty: qty, rate, totalAmount, itemName: l.itemName || l.name || 'Manual Cost', section: l.section || 'OTHERS', uom: l.uom || 'RS' };
    });
    const normalizedSales = (salesLines || []).map((l) => ({ ...l, source: 'MANUAL', section: l.section || 'COST OF SALES', itemName: l.itemName || 'Sales Cost', consumedQty: Number(l.consumedQty || 1), rate: Number(l.rate || 0), totalAmount: Number(l.totalAmount || (Number(l.consumedQty || 1) * Number(l.rate || 0))) }));
    const payload = recalcRunTotals({
      tenantId: req.tenantId, costingNo, month: Number(month), year: Number(year), costingType, foundry, department,
      totalWorkingDays: Number(totalWorkingDays || 0), totalHeats: Number(totalHeats || 0), averageHeat: totalHeats && totalWorkingDays ? Number(totalHeats) / Number(totalWorkingDays) : 0,
      liquidMetalMt: Number(liquidMetalMt || 0), productionWtMt: Number(productionWtMt || 0), rejectionWtMt: Number(rejectionWtMt || 0), goodCastingWtMt: Number(goodCastingWtMt || 0), noBakeProductionMt: Number(noBakeProductionMt || 0), totalProductionMt: Number(goodCastingWtMt || 0) + Number(noBakeProductionMt || 0),
      yieldPercent: liquidMetalMt ? Number(goodCastingWtMt) / Number(liquidMetalMt) * 100 : 0, rejectionPercent: productionWtMt ? Number(rejectionWtMt) / Number(productionWtMt) * 100 : 0,
      preparedBy: req.user.userId, preparedByName: req.user.name, lines: storeLines, manualLines: normalizedManual, salesLines: normalizedSales, remarks,
    });
    const existing = await CostingRun.findOne({ tenantId: req.tenantId, costingType, year, month, isDeleted: false }).lean();
    const run = await CostingRun.findOneAndUpdate({ tenantId: req.tenantId, costingType, year, month }, payload, { upsert: true, new: true, runValidators: true });
    if (existing && run.totalInputCostPerKg > (existing.totalInputCostPerKg || 0) * 1.05) {
      const msg = `Costing increased for ${titleType(costingType)} ${MONTHS[month-1]}-${year}. Previous ₹${Number(existing.totalInputCostPerKg||0).toFixed(2)}/kg, Now ₹${Number(run.totalInputCostPerKg||0).toFixed(2)}/kg.`;
      await StoreNotification.create({ tenantId: req.tenantId, type: 'COST_INCREASE', title: 'Costing increase alert', message: msg, referenceModel: 'CostingRun', referenceId: run._id, referenceNo: run.costingNo, priority: 'HIGH' });
      if (process.env.COSTING_ALERT_EMAILS) sendEmail({ to: process.env.COSTING_ALERT_EMAILS.split(','), subject: 'Costing Increase Alert', html: `<pre>${msg}</pre>` });
      if (process.env.COSTING_ALERT_WHATSAPP) process.env.COSTING_ALERT_WHATSAPP.split(',').forEach((p) => sendWhatsApp(p.trim(), msg));
    }
    res.json({ success: true, data: run });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const esc = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
const createPdf = (pagesOps) => {
  const pages = Array.isArray(pagesOps[0]) ? pagesOps : [pagesOps];
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const contentIds = pages.map((ops) => add(`<< /Length ${Buffer.byteLength(ops.join('\n'))} >>\nstream\n${ops.join('\n')}\nendstream`));
  const pagesId = objects.length + 1;
  const pageIds = pages.map((ops, i) => pagesId + 1 + i);
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  contentIds.forEach((contentId) => {
    add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const chunks=['%PDF-1.4\n']; const offsets=[0];
  objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(chunks.join('')));chunks.push(`${i+1} 0 obj\n${body}\nendobj\n`);});
  const xref=Buffer.byteLength(chunks.join('')); chunks.push(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`); offsets.slice(1).forEach((off)=>chunks.push(String(off).padStart(10,'0')+' 00000 n \n')); chunks.push(`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`); return Buffer.from(chunks.join(''));
};

const costingPdfBuffer = (run) => {
  const rows=[...(run.lines||[]), ...(run.manualLines||[])].sort((a,b)=>String(a.section).localeCompare(String(b.section)) || String(a.itemName).localeCompare(String(b.itemName)));
  const pages = [];
  let index = 0;
  let sl = 1;
  while (index < rows.length || pages.length === 0) {
    const ops=[];
    const t=(x,y,v,size=7,b=false)=>ops.push(`BT /${b?'F2':'F1'} ${size} Tf ${x} ${y} Td (${esc(v)}) Tj ET`);
    const l=(x1,y1,x2,y2)=>ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    const cols=[35,60,250,310,355,415,490,560,630,710,805]; let y=480;
    t(330,565,'JPK METALLICS PVT. LTD',12,true); t(355,550,'DUCTILE DIVISION',10,true); t(382,536,'AMRABERIA',9,true);
    t(35,560,`TOTAL WORKING DAY = ${run.totalWorkingDays || 0}`,9,true); t(35,546,`TOTAL NO. OF HEAT = ${run.totalHeats || 0}`,9,true); t(35,532,`AVERAGE HEAT = ${Number(run.averageHeat||0).toFixed(2)}`,9,true); t(35,518,`GOOD CASTING WT. M/T = ${run.goodCastingWtMt}`,9,true);
    t(35,496,`${titleType(run.costingType)} ${MONTHS[run.month-1]} - ${run.year}`,11,true); t(590,496,`Date :- ${new Date(run.datePrepared||run.createdAt||Date.now()).toLocaleDateString('en-GB')}`,9,true); t(760,496,`Page ${pages.length+1}`,8,true);
    ['SL','COST HEAD / ITEM','UNIT','RATE','CONSUMED','TOTAL AMOUNT','COST/TON','COST/KG','CONSUM %'].forEach((h,i)=>t(cols[i]+2,y,h,7,true)); l(35,475,805,475);
    y-=14; let current='';
    while (index < rows.length && y >= 74) {
      const r = rows[index];
      if (current!==r.section) {
        if (y < 86) break;
        current=r.section; t(62,y,current,8,true); y-=12;
      }
      t(40,y,sl++,7); t(62,y,String(r.itemName||'').slice(0,34),7); t(252,y,r.uom||'',7); t(313,y,Number(r.rate||0).toFixed(2),7); t(356,y,Number(r.consumedQty||0).toFixed(2),7); t(418,y,Number(r.totalAmount||0).toFixed(2),7); t(493,y,Number(r.costPerTon||0).toFixed(2),7); t(563,y,Number(r.costPerKg||0).toFixed(3),7); t(633,y,Number(r.consumptionPercent||0).toFixed(2),7);
      y-=11; index++;
    }
    l(35,88,805,88);
    t(40,74,`Material Cost/KG: Rs ${Number(run.materialCostPerKg||0).toFixed(2)}     Conversion Cost/KG: Rs ${Number(run.conversionCostPerKg||0).toFixed(2)}     Power Cost/KG: Rs ${Number(run.powerCostPerKg||0).toFixed(2)}`,9,true);
    t(40,56,`TOTAL INPUT COST PER TON & PER KG = Rs ${Number(run.totalInputCostPerTon||0).toFixed(2)} / Rs ${Number(run.totalInputCostPerKg||0).toFixed(2)}    Cost of Production: Rs ${Number(run.costOfProduction||0).toLocaleString('en-IN')}    Cost of Sales: Rs ${Number(run.costOfSales||0).toLocaleString('en-IN')}`,9,true);
    pages.push(ops);
  }
  return createPdf(pages);
};

const downloadPdf = async (req,res) => {
  const run = await CostingRun.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted:false }).lean();
  if (!run) return res.status(404).json({ success:false, message:'Costing not found' });
  res.setHeader('Content-Type','application/pdf'); res.setHeader('Content-Disposition',`inline; filename="${run.costingNo.replace(/\//g,'-')}.pdf"`); res.send(costingPdfBuffer(run));
};

const downloadExcel = async (req,res) => {
  const run = await CostingRun.findOne({ _id: req.params.id, tenantId: req.tenantId, isDeleted:false }).lean();
  if (!run) return res.status(404).json({ success:false, message:'Costing not found' });
  const wb = XLSX.utils.book_new();
  const summary = [['JPK METALLICS PVT. LTD'], [titleType(run.costingType), `${MONTHS[run.month-1]}-${run.year}`], ['Good Casting WT M/T', run.goodCastingWtMt], ['Cost of Production', run.costOfProduction], ['Cost of Sales', run.costOfSales], ['Total Input Cost Per Ton', run.totalInputCostPerTon], ['Total Input Cost Per KG', run.totalInputCostPerKg], ['Material Cost/KG', run.materialCostPerKg], ['Conversion Cost/KG', run.conversionCostPerKg], ['Power Cost/KG', run.powerCostPerKg]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');
  const rows = [...(run.lines||[]), ...(run.manualLines||[]), ...(run.salesLines||[])].map((l)=>({ Section:l.section, Source:l.source, Type:l.itemType, MotherItem:l.motherItem, SKU:l.skuCode, Item:l.itemName, UOM:l.uom, Rate:l.rate, OutwardQty:l.outwardQty, FloorLeftQty:l.floorLeftQty, ConsumedQty:l.consumedQty, TotalAmount:l.totalAmount, CostPerTon:l.costPerTon, CostPerKg:l.costPerKg, Notes:l.notes }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Costing Lines');
  const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition',`attachment; filename="${run.costingNo.replace(/\//g,'-')}.xlsx"`); res.send(buf);
};

const template = async (req,res) => res.json({ success:true, data:{ itemTypes: ITEM_TYPES, manualDefaults: manualDefaults(req.query.type), costingTypes: ['GREEN_SAND','NO_BAKE'] } });

module.exports = { listCostings, getCosting, generateCosting, saveFloorBalance, downloadPdf, downloadExcel, template };
