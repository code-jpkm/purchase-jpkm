const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanFoundry = (value = '') => String(value)
  .replace(/\(.*?\)/g, '')
  .replace(/ductile\s*iron/ig, 'D. I')
  .replace(/cast\s*iron/ig, 'C. I')
  .replace(/\s+/g, ' ')
  .trim();

const foundryAliases = (value = '') => {
  const raw = String(value || '').trim();
  const cleaned = cleanFoundry(raw);
  const compact = cleaned.replace(/[.\s]/g, '').toUpperCase();
  const set = new Set([raw, cleaned]);
  if (compact === 'DI' || /DUCTILE/i.test(raw)) {
    ['D. I', 'DI', 'D I', 'D.I', 'Ductile Iron', 'D. I (Ductile Iron)'].forEach((v) => set.add(v));
  }
  if (compact === 'CI' || /CAST\s*IRON/i.test(raw)) {
    ['C. I', 'CI', 'C I', 'C.I', 'Cast Iron', 'C. I (Cast Iron)'].forEach((v) => set.add(v));
  }
  return [...set].filter(Boolean);
};

const foundryRegex = (value = '') => {
  const aliases = foundryAliases(value).map(escapeRegex);
  return new RegExp(`^(${aliases.join('|')})$`, 'i');
};

const deptRegex = (value = '') => new RegExp(`^${escapeRegex(String(value || '').trim())}$`, 'i');

const getStockEntry = (item, foundry, department) => {
  const fRe = foundry ? foundryRegex(foundry) : null;
  const dRe = department ? deptRegex(department) : null;
  const stocks = Array.isArray(item?.stocks) ? item.stocks : [];
  return stocks.find((s) => (!fRe || fRe.test(s.foundry || '')) && (!dRe || dRe.test(s.department || '')));
};

const buildItemLocationFilter = (foundry, department) => {
  const filters = [];
  const elem = {};
  if (foundry) elem.foundry = foundryRegex(foundry);
  if (department) elem.department = deptRegex(department);
  if (Object.keys(elem).length) filters.push({ stocks: { $elemMatch: elem } });
  const top = {};
  if (foundry) top.foundry = foundryRegex(foundry);
  if (department) top.department = deptRegex(department);
  if (Object.keys(top).length) filters.push(top);
  return filters.length ? { $or: filters } : null;
};

module.exports = { cleanFoundry, foundryAliases, foundryRegex, deptRegex, getStockEntry, buildItemLocationFilter };
