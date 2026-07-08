const Tenant = require('../models/Tenant.schema');
const AiMonitorFinding = require('../models/Ai-monitor-finding.schema');
const { runAIMonitoring, geminiMonitorSummary } = require('../services/ai-monitor.service');

const overview = async (req, res) => {
  const [summaryAgg, findings] = await Promise.all([
    AiMonitorFinding.aggregate([
      { $match: { tenantId: req.tenantId, status: 'Open' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    AiMonitorFinding.find({ tenantId: req.tenantId, status: 'Open' }).sort({ severity: 1, score: -1, createdAt: -1 }).limit(100).lean(),
  ]);
  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  summaryAgg.forEach((x) => { summary[x._id] = x.count; });
  res.json({ success: true, data: { summary, findings } });
};

const runNow = async (req, res) => {
  const result = await runAIMonitoring(req.tenantId);
  const summaryText = req.body?.withGemini ? await geminiMonitorSummary(req.tenantId) : '';
  res.json({ success: true, data: { ...result, summaryText } });
};

const resolveFinding = async (req, res) => {
  const data = await AiMonitorFinding.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { status: req.body.status || 'Resolved', resolvedBy: req.user.userId, resolvedAt: new Date() }, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Finding not found' });
  res.json({ success: true, data });
};

const runForAllTenants = async () => {
  const tenants = await Tenant.find({ isDeleted: { $ne: true }, status: { $ne: 'inactive' } });
  const out = [];
  for (const t of tenants) out.push(await runAIMonitoring(t._id));
  return out;
};

module.exports = { overview, runNow, resolveFinding, runForAllTenants };
