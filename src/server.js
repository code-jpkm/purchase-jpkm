require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const UserPresence = require('./models/User.schema');
const tenantMiddleware = require('./middleware/tenant');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

const io = new Server(server, {
  cors: { origin: allowedOrigins.includes('*') ? '*' : allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: 'Too many requests' });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts. Please try again later.' });
app.use('/api/', limiter);

app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const { login, refreshToken } = require('./controllers/auth.controller');
app.post('/api/auth/login', loginLimiter, login);
app.post('/api/auth/refresh', refreshToken);

const storeRoutes = require('./routes/index');
// Main IMS API routes. Frontend may use either /api or /api/store.
// Keeping both prevents 404 when .env points to http://localhost:5001/api.
app.use('/api', storeRoutes);
app.use('/api/store', storeRoutes);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Invalid socket token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  if (socket.user?.userId) {
    UserPresence.findByIdAndUpdate(socket.user.userId, { isOnline: true, lastSeenAt: new Date() }).catch(() => {});
  }

  socket.on('join-tenant', (tenantId) => {
    if (String(tenantId) !== String(socket.user?.tenantId)) return;
    socket.join(`tenant:${tenantId}`);
    logger.info(`Socket ${socket.id} joined tenant: ${tenantId}`);
  });

  socket.on('disconnect', () => {
    if (socket.user?.userId) {
      UserPresence.findByIdAndUpdate(socket.user.userId, { isOnline: false, lastSeenAt: new Date() }).catch(() => {});
    }
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

cron.schedule('0 7 * * *', async () => {
  logger.info('Running daily low stock check...');
  try {
    const StoreItem = require('./models/Store-item.schema');
    const { checkAndNotifyLowStock } = require('./services/stock.service');
    const items = await StoreItem.find({ isDeleted: false, isActive: true });
    for (const item of items) {
      for (const stock of item.stocks) {
        await checkAndNotifyLowStock(item.tenantId, item, stock);
      }
    }
  } catch (err) {
    logger.error(`Cron low stock error: ${err.message}`);
  }
});

cron.schedule('0 9 * * 1', async () => {
  logger.info('Running weekly budget variance check...');
  try {
    const Budget = require('./models/Budget.schema');
    const { runBudgetVarianceCheck } = require('./controllers/budget.controller');
    const now = new Date();
    const budgets = await Budget.find({ status: 'Approved', year: now.getFullYear(), month: now.getMonth() + 1 });
    for (const budget of budgets) await runBudgetVarianceCheck(budget);
    logger.info(`Checked ${budgets.length} active budgets`);
  } catch (err) {
    logger.error(`Cron budget check error: ${err.message}`);
  }
});



cron.schedule('30 6,12,18 * * *', async () => {
  logger.info('Running AI monitoring checks...');
  try {
    const { runForAllTenants } = require('./controllers/ai-monitoring.controller');
    await runForAllTenants();
  } catch (err) {
    logger.error(`AI monitoring cron error: ${err.message}`);
  }
});

cron.schedule('0 8,14,18 * * *', async () => {
  logger.info('Running FMS due/overdue reminder check...');
  try {
    const { syncAllOpenTasks, sendFmsDueReminders } = require('./services/fms.service');
    const Tenant = require('./models/Tenant.schema');
    const tenants = await Tenant.find({ isDeleted: { $ne: true }, status: { $ne: 'inactive' } });
    for (const tenant of tenants) await syncAllOpenTasks(tenant._id);
    const sent = await sendFmsDueReminders();
    logger.info(`FMS reminder notifications generated: ${sent}`);
  } catch (err) {
    logger.error(`Cron FMS reminder error: ${err.message}`);
  }
});

app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  server.listen(PORT, () => {
    logger.info(`JPK Store Server running on port ${PORT}`);
  });
});

module.exports = { app, io };
