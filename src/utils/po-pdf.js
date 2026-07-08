const { indianNumberToWords } = require('./number-to-words');

const esc = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/[\r\n]+/g, ' ');

const money = (n) => Number(n || 0).toFixed(2);

const splitText = (text, maxChars) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

const createPdf = (ops) => {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');
  const content = ops.join('\n');
  const contentObj = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  const page = add(`<< /Type /Page /Parent 5 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObj} 0 R >>`);
  const pages = add(`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(chunks.join('')));
    chunks.push(`${i + 1} 0 obj\n${body}\nendobj\n`);
  });
  const xref = Buffer.byteLength(chunks.join(''));
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((off) => chunks.push(String(off).padStart(10, '0') + ' 00000 n \n'));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(chunks.join(''));
};

const vendorAddressText = (po, vendor = {}) => {
  const address = vendor.address || {};
  const fromVendor = [
    vendor.name || po.vendorName,
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].filter(Boolean).join(', ');
  return po.vendorAddressText || fromVendor || po.vendorName || '';
};

const drawWrapped = (text, x, y, value, maxChars, size = 8, leading = 10, bold = false, maxLines = 4) => {
  splitText(value, maxChars).slice(0, maxLines).forEach((line, idx) => text(x, y - idx * leading, line, size, bold));
};

const generatePurchaseOrderPdfBuffer = (po, vendor = {}) => {
  const ops = [];
  const text = (x, y, value, size = 8, bold = false) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET`);
  const line = (x1, y1, x2, y2) => ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x, y, w, h) => ops.push(`${x} ${y} ${w} ${h} re S`);

  const left = 36;
  const right = 559;
  const top = 790;
  const bottom = 52;
  rect(left, bottom, right - left, top - bottom);

  text(46, 760, 'JPK', 18, true);
  text(126, 772, 'JPK METALLICS PVT. LTD.', 11, true);
  text(126, 758, 'Amraberia, Mahishrekha, Uluberia Howrah, 711303, PH: , Fax:-', 8);
  text(126, 746, 'West Bengal', 8);
  text(126, 734, 'purchasefac@jpkm.in', 8);
  text(314, 724, 'PURCHASE ORDER', 13, true);
  text(418, 772, po.qsfNo || 'QSF/PUR/--', 9, true);
  text(418, 758, 'OFFICE/PARTY/SITE/STORE COPY', 8);
  text(418, 742, `PO Type : ${po.poType === 'SGST' ? 'SGST' : 'CGST,SGST'}`, 8, true);
  text(48, 716, 'ISO 9001:2015', 8);
  line(left, 708, right, 708);

  line(230, 708, 230, 612);
  line(404, 708, 404, 612);
  line(left, 612, right, 612);
  text(44, 696, 'Vendor Name & Address', 8, true);
  text(236, 696, 'Billing Address', 8, true);
  text(410, 696, `PO Ref : ${po.poNo}`, 8, true);
  text(410, 680, `Date : ${new Date(po.poDate).toLocaleDateString('en-GB')}`, 8);
  text(410, 664, 'Validity : --', 8);
  const delv = po.subPOs?.[0]?.expectedDelivery || po.poDate;
  text(410, 648, `Delv. Date : ${new Date(delv).toLocaleDateString('en-GB')}`, 8);
  text(410, 632, 'Rev. No : --', 8);

  drawWrapped(text, 44, 680, vendorAddressText(po, vendor), 35, 8, 10, false, 6);
  drawWrapped(text, 236, 680, 'JPK METALLICS PVT. LTD. P-15, BENTINCK STREET BENTINCK HOUSE, 3RD FLOOR KOLKATA-700001 WEST BENGAL', 34, 8, 10, false, 6);

  line(230, 612, 230, 548);
  line(404, 612, 404, 548);
  line(left, 548, right, 548);
  text(44, 596, 'Kind Attn. :', 8, true);
  text(101, 596, vendor.kindAttention || vendor.contactPerson || po.vendorKindAttention || '', 8);
  text(44, 580, 'Phone      :', 8, true);
  text(101, 580, vendor.phone || vendor.alternatePhone || po.vendorPhone || po.vendorContact || '', 8);
  text(44, 564, 'GSTIN      :', 8, true);
  text(101, 564, vendor.gstNo || po.vendorGstin || '', 8);
  text(236, 596, 'Shipping Address', 8, true);
  drawWrapped(text, 236, 580, 'JPK METALLICS PVT. LTD. AMRABERIA, MAHISHREKHA ULUBERIA HOWRAH-711303 WEST BENGAL', 32, 8, 10, false, 5);
  text(44, 535, 'Please supply the material/services as detailed below:-', 8);
  line(left, 530, right, 530);

  const items = Array.isArray(po.subPOs) ? po.subPOs : [];
  const rowH = items.length > 8 ? 21 : 24;
  const headerH = 30;
  const headerY = 530;
  const tableBottom = headerY - headerH - (Math.max(items.length, 1) * rowH);
  const col = [36, 64, 220, 272, 313, 353, 392, 423, 462, 559];
  for (const x of col) line(x, headerY, x, tableBottom);
  line(left, headerY - headerH, right, headerY - headerH);
  text(43, 514, 'SL', 7, true);
  text(41, 504, 'No.', 7, true);
  text(98, 514, 'Item Description', 7, true);
  text(112, 504, 'HSN CODE', 7, true);
  text(226, 509, 'Unit', 7, true);
  text(278, 509, 'Qty', 7, true);
  text(319, 509, 'Rate', 7, true);
  text(357, 514, 'Disc.', 7, true);
  text(361, 504, '%', 7, true);
  text(397, 514, 'Disc.', 7, true);
  text(397, 504, 'Amt.', 7, true);
  text(429, 509, 'Taxable', 7, true);
  text(514, 509, 'Total', 7, true);

  items.forEach((item, idx) => {
    const yTop = headerY - headerH - (idx * rowH);
    const y = yTop - 14;
    line(left, yTop - rowH, right, yTop - rowH);
    text(43, y, idx + 1, 7);
    drawWrapped(text, 68, y + 3, `${item.itemName || ''}${item.hsnCode ? ` / ${item.hsnCode}` : ''}`, 34, 7, 8, false, 2);
    text(224, y, item.uom || '', 7);
    text(278, y, item.orderedQty || 0, 7);
    text(316, y, money(item.rate), 7);
    text(361, y, item.discPercent || 0, 7);
    text(397, y, money(item.discountAmount), 7);
    text(429, y, money(item.taxableValue), 7);
    text(510, y, money(item.totalValue), 7, true);
  });
  if (items.length === 0) {
    line(left, tableBottom, right, tableBottom);
    text(240, tableBottom + 8, 'No items', 8);
  }

  const totalsTop = tableBottom - 2;
  line(392, totalsTop, right, totalsTop);
  line(392, totalsTop, 392, totalsTop - 46);
  line(462, totalsTop, 462, totalsTop - 46);
  line(right, totalsTop, right, totalsTop - 46);
  line(392, totalsTop - 23, right, totalsTop - 23);
  line(392, totalsTop - 46, right, totalsTop - 46);
  text(398, totalsTop - 15, 'Taxable', 8, true);
  text(498, totalsTop - 15, money(po.subtotalValue || 0), 8, true);
  text(398, totalsTop - 37, 'Total', 8, true);
  text(498, totalsTop - 37, money(po.totalValue || 0), 8, true);

  const wordsY = totalsTop - 68;
  const words = po.amountInWords || indianNumberToWords(po.totalValue || 0);
  text(44, wordsY, 'Amount In Words ->', 8, true);
  drawWrapped(text, 158, wordsY, words, 78, 8, 10, false, 2);
  text(44, wordsY - 28, 'Pay terms         ->', 8, true);
  text(158, wordsY - 28, po.payTerms || '.', 8);
  text(44, wordsY - 44, 'Delivery Terms    ->', 8, true);
  text(158, wordsY - 44, po.deliveryTerms || '', 8);
  text(44, wordsY - 60, 'Shipping Mode     ->', 8, true);
  text(158, wordsY - 60, po.shippingMode || 'ROADWAYS', 8);
  text(44, wordsY - 76, 'Payment method    ->', 8, true);
  text(158, wordsY - 76, po.paymentMethod || 'NEFT/CHEQUE', 8);
  text(158, wordsY - 92, po.deliveryLocation || 'KOLKATA', 8);

  line(left, 142, right, 142);
  drawWrapped(text, 44, 132, 'You are required to charge GST clearly on the invoice to be prepared as per the GST Law. Please note that JPK Metallics Pvt. Ltd. shall get the input credit of GST based on return filed by you. In case JPK Metallics Pvt. Ltd. suffers any loss of input credit due to non-furnishing of invoices in a timely manner or in accordance with the prevailing law, then be entitled to recover the said amount from you either by deductions from any balance payment or by raising a debit note.', 132, 6, 8, false, 5);
  line(left, 94, right, 94);
  text(220, 76, 'Checked By', 8, true);
  text(394, 76, 'Authorized By', 8, true);

  return createPdf(ops);
};

module.exports = { generatePurchaseOrderPdfBuffer };
