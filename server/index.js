require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const paymentRoutes = require('./routes/payments');
const { startScheduler, checkSubscriptions, restartScheduler } = require('./scheduler');
const { getDb, dbRun } = require('./db');
const { getClient, getStatus, subscribeToEvents, getLastQR, forceRestart, setIncomingMessageHandler, sendPaymentLink, formatPhone } = require('./whatsapp');
const { router: settingsRouter, loadSettingsToEnv } = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Слишком много запросов' },
});
app.use('/api/', apiLimiter);

// Public routes
app.use('/api/auth', authRoutes);
app.post('/api/payments/webhook', paymentRoutes);

// Public payment page route — JWT токен бессрочный
app.get('/api/pay/:token', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { dbGet: _dbGet } = require('./db');
    const { getSetting } = require('./routes/settings');
    const secret = process.env.JWT_SECRET || 'secret';
    let payload;
    try {
      payload = jwt.verify(req.params.token, secret);
    } catch {
      return res.status(400).json({ error: 'Ссылка недействительна' });
    }
    if (payload.type !== 'pay') return res.status(400).json({ error: 'Неверный тип токена' });
    const client = await _dbGet('SELECT id, name, phone, subscription_end FROM clients WHERE id = ?', [payload.client_id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    const price = await getSetting('subscription_price') || '250';
    const sbpPhone = await getSetting('sbp_phone') || '';
    const sbpBank = await getSetting('sbp_bank') || '';
    const sbpName = await getSetting('sbp_name') || '';
    res.json({ client, price, sbpPhone, sbpBank, sbpName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected routes
app.use('/api/clients', requireAuth, clientRoutes);
app.use('/api/payments', requireAuth, paymentRoutes);
app.use('/api/settings', requireAuth, settingsRouter);

// WhatsApp status + QR
app.get('/api/admin/whatsapp-status', requireAuth, (req, res) => {
  res.json(getStatus());
});

// SSE стрим для QR кода WhatsApp в браузере
app.get('/api/admin/whatsapp-qr-stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Если уже есть QR — сразу отдать
  const existingQR = getLastQR();
  if (existingQR) send({ type: 'qr', qr: existingQR });
  // Если уже готов
  if (getStatus().ready) send({ type: 'ready' });

  const unsub = subscribeToEvents(send);
  req.on('close', unsub);
});

app.get('/api/admin/whatsapp-qr', requireAuth, (req, res) => {
  res.json({ status: getStatus(), qr: getLastQR() });
});

app.post('/api/admin/whatsapp-restart', requireAuth, async (req, res) => {
  try {
    await forceRestart();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Отправить напоминание об оплате конкретному клиенту (ручная — не блокирует автоматику)
app.post('/api/admin/send-reminder/:id', requireAuth, async (req, res) => {
  try {
    const { dbGet: _dbGet, dbRun: _dbRun } = require('./db');
    const { sendReminderBeforeExpiry } = require('./whatsapp');
    const client = await _dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    if (!client.phone) return res.status(400).json({ error: 'У клиента нет номера телефона' });
    await sendReminderBeforeExpiry(client);
    // Пишем тип reminder_manual — scheduler смотрит только на reminder
    await _dbRun(
      `INSERT INTO notifications (client_id, type, message, status) VALUES (?, 'reminder_manual', ?, 'sent')`,
      [client.id, `Ручное напоминание об оплате`]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ручная отправка WhatsApp сообщения клиенту
app.post('/api/admin/send-message', requireAuth, async (req, res) => {
  const { client_id, message } = req.body;
  if (!client_id || !message) return res.status(400).json({ error: 'Нужны client_id и message' });
  try {
    const { dbGet: _dbGet } = require('./db');
    const { sendMessage } = require('./whatsapp');
    const client = await _dbGet('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    if (!client.phone) return res.status(400).json({ error: 'У клиента нет номера телефона' });
    await sendMessage(client.phone, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin trigger manual check
app.post('/api/admin/check-subscriptions', requireAuth, async (req, res) => {
  try {
    await checkSubscriptions();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve React frontend
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Init DB and start
getDb();
setTimeout(async () => {
  await loadSettingsToEnv();
  await dbRun(`ALTER TABLE clients ADD COLUMN is_free INTEGER DEFAULT 0`).catch(() => {});
  await startScheduler();

  // Обработчик входящих WhatsApp сообщений — триггер оплаты
  const { dbAll } = require('./db');
  setIncomingMessageHandler(async (msg) => {
    const from = msg.from; // формат: 79XXXXXXXXX@c.us
    const phoneRaw = from.replace('@c.us', '');

    // Ищем клиента по номеру (нормализуем разные форматы)
    const clients = await dbAll(`SELECT * FROM clients WHERE phone IS NOT NULL AND phone != ''`);
    const matched = clients.find(c => {
      let p = (c.phone || '').replace(/\D/g, '');
      if (p.startsWith('8')) p = '7' + p.slice(1);
      if (!p.startsWith('7') && p.length === 10) p = '7' + p;
      return p === phoneRaw || p === phoneRaw.replace(/^7/, '8');
    });

    if (!matched) {
      console.log(`[WhatsApp] Входящее от неизвестного номера: ${phoneRaw}`);
      return;
    }

    console.log(`[WhatsApp] Запрос оплаты от ${matched.name} (${matched.phone})`);
    await sendPaymentLink(matched.phone, matched.id, matched.name);
  });

  // Запускаем WhatsApp клиент ПОСЛЕ установки обработчика
  getClient();
}, 600);

app.listen(PORT, () => {
  console.log(`[Server] Запущен на порту ${PORT}`);
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
});
