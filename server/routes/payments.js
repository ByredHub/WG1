const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { dbRun, dbGet, dbAll } = require('../db');
const yukassa = require('../yukassa');
const platega = require('../platega');
const { enablePeer } = require('../wgEasy');
const { sendActivationConfirmation } = require('../whatsapp');

function getProvider() {
  return process.env.PAYMENT_PROVIDER || 'platega';
}

// POST /api/payments/create
router.post('/create', async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id обязателен' });

  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const paymentId = uuidv4();
    const provider = getProvider();

    let paymentUrl = null;
    let externalId = null;

    if (provider === 'platega') {
      const result = await platega.createPayment(client, paymentId);
      paymentUrl = result.payment_url || result.url || null;
      externalId = result.payment_id || result.id || paymentId;
    } else if (provider === 'yukassa') {
      const result = await yukassa.createPayment(client, paymentId);
      paymentUrl = result.confirmation?.confirmation_url || null;
      externalId = result.id;
    } else {
      return res.status(400).json({ error: 'Неизвестный провайдер оплаты' });
    }

    await dbRun(
      `INSERT INTO payments (id, client_id, amount, status, yukassa_payment_id, payment_url) VALUES (?, ?, ?, 'pending', ?, ?)`,
      [paymentId, client_id, parseInt(process.env.SUBSCRIPTION_PRICE || '250'), externalId, paymentUrl]
    );

    res.json({ payment_id: paymentId, payment_url: paymentUrl, amount: process.env.SUBSCRIPTION_PRICE || '250', provider });
  } catch (err) {
    console.error('Ошибка создания платежа:', err.message);
    res.status(500).json({ error: 'Ошибка создания платежа: ' + err.message });
  }
});

// POST /api/payments/webhook (Platega + ЮКасса)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  res.sendStatus(200);

  let event;
  try { event = JSON.parse(req.body); } catch { return; }

  const provider = getProvider();
  let orderId = null;
  let clientId = null;

  try {
    if (provider === 'platega') {
      // Platega: { status: 'success', order_id: '...', ... }
      if (event.status !== 'success') return;
      orderId = event.order_id;
      const payment = await dbGet('SELECT * FROM payments WHERE id = ?', [orderId]);
      if (!payment || payment.status === 'paid') return;
      clientId = payment.client_id;
      await dbRun(`UPDATE payments SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=?`, [payment.id]);
    } else {
      // ЮКасса: { event: 'payment.succeeded', object: { ... } }
      if (event.event !== 'payment.succeeded') return;
      const yukassaId = event.object?.id;
      clientId = event.object?.metadata?.client_id;
      if (!yukassaId || !clientId) return;
      const payment = await dbGet('SELECT * FROM payments WHERE yukassa_payment_id = ?', [yukassaId]);
      if (!payment || payment.status === 'paid') return;
      clientId = payment.client_id;
      await dbRun(`UPDATE payments SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=?`, [payment.id]);
    }

    if (clientId) await activateClientSubscription(clientId);
  } catch (err) {
    console.error('[Webhook] Ошибка:', err.message);
  }
});

// POST /api/payments/manual — ручная оплата
router.post('/manual', async (req, res) => {
  const { client_id, amount } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id обязателен' });

  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const paymentId = uuidv4();
    const price = parseInt(amount || process.env.SUBSCRIPTION_PRICE || '250');

    await dbRun(
      `INSERT INTO payments (id, client_id, amount, status, paid_at) VALUES (?, ?, ?, 'paid', CURRENT_TIMESTAMP)`,
      [paymentId, client_id, price]
    );
    await activateClientSubscription(client_id);
    res.json({ success: true, payment_id: paymentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const payment = await dbGet('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
    await dbRun(`UPDATE payments SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=?`, [payment.id]);
    await activateClientSubscription(payment.client_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments
router.get('/', async (req, res) => {
  try {
    const payments = await dbAll(`
      SELECT p.*, c.name as client_name, c.phone as client_phone
      FROM payments p LEFT JOIN clients c ON p.client_id = c.id
      ORDER BY p.created_at DESC LIMIT 100
    `);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function activateClientSubscription(clientId) {
  const client = await dbGet('SELECT * FROM clients WHERE id = ?', [clientId]);
  if (!client) return;

  const base = client.status === 'expired' || !client.subscription_end ? dayjs() : dayjs(client.subscription_end);
  const newEnd = base.add(30, 'day').format('YYYY-MM-DD');

  await dbRun(`UPDATE clients SET subscription_end=?, status='active', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [newEnd, clientId]);

  if (client.wg_peer_id) {
    try { await enablePeer(client.wg_peer_id); } catch (err) { console.error(`[Payment] Ошибка VPN ${client.name}:`, err.message); }
  }
  try { await sendActivationConfirmation(client, newEnd); } catch (err) { console.error(`[Payment] Ошибка WA ${client.name}:`, err.message); }
}

module.exports = router;
