const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { dbRun, dbGet, dbAll } = require('../db');
const { getPeers, enablePeer, disablePeer, getPeerConfig } = require('../wgEasy');

// GET /api/clients/wg/peers
router.get('/wg/peers', async (req, res) => {
  try {
    const peers = await getPeers();
    res.json(peers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/wg/peers/:peerId/config — скачать конфиг пира
router.get('/wg/peers/:peerId/config', async (req, res) => {
  try {
    const config = await getPeerConfig(req.params.peerId);
    const peers = await getPeers();
    const peer = peers.find(p => p.id === req.params.peerId);
    const filename = peer ? `${peer.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.conf` : 'wireguard.conf';
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/wg/peers — создать новый пир в WG Easy
router.post('/wg/peers', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Имя пира обязательно' });
    const { createPeer } = require('../wgEasy');
    const peer = await createPeer(name);
    res.status(201).json(peer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/stats
router.get('/stats', async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const in3days = dayjs().add(3, 'day').format('YYYY-MM-DD');
    const price = parseInt(process.env.SUBSCRIPTION_PRICE || '250');

    const [total, active, expired, expiringSoon] = await Promise.all([
      dbGet("SELECT COUNT(*) as c FROM clients"),
      dbGet("SELECT COUNT(*) as c FROM clients WHERE status = 'active'"),
      dbGet("SELECT COUNT(*) as c FROM clients WHERE status = 'expired'"),
      dbGet("SELECT COUNT(*) as c FROM clients WHERE status = 'active' AND date(subscription_end) <= ? AND date(subscription_end) >= ?", [in3days, today]),
    ]);

    res.json({
      total: total.c,
      active: active.c,
      expired: expired.c,
      expiringSoon: expiringSoon.c,
      monthlyRevenue: active.c * price,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM clients';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') { conditions.push('status = ?'); params.push(status); }
    if (search) { conditions.push('(name LIKE ? OR phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sort_order ASC, subscription_end ASC';

    const clients = await dbAll(query, params);
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clients/reorder — сохранить новый порядок
router.patch('/reorder', async (req, res) => {
  try {
    const { ids } = req.body; // массив id в нужном порядке
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be array' });
    for (let i = 0; i < ids.length; i++) {
      await dbRun('UPDATE clients SET sort_order = ? WHERE id = ?', [i, ids[i]]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const [payments, notifications] = await Promise.all([
      dbAll('SELECT * FROM payments WHERE client_id = ? ORDER BY created_at DESC', [client.id]),
      dbAll('SELECT * FROM notifications WHERE client_id = ? ORDER BY sent_at DESC LIMIT 20', [client.id]),
    ]);

    res.json({ ...client, payments, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
router.post('/', async (req, res) => {
  const { name, phone, wg_peer_id, wg_peer_name, router_model, notes, days = 30 } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });

  const id = uuidv4();
  const subscription_end = dayjs().add(parseInt(days), 'day').format('YYYY-MM-DD');

  try {
    await dbRun(
      `INSERT INTO clients (id, name, phone, wg_peer_id, wg_peer_name, router_model, subscription_end, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone, wg_peer_id || null, wg_peer_name || null, router_model || null, subscription_end, notes || null]
    );
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [id]);
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clients/:id
router.patch('/:id', async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const { name, phone, wg_peer_id, wg_peer_name, router_model, notes, subscription_end, status, is_free } = req.body;
    const u = {
      name: name ?? client.name,
      phone: phone ?? client.phone,
      wg_peer_id: wg_peer_id !== undefined ? wg_peer_id : client.wg_peer_id,
      wg_peer_name: wg_peer_name !== undefined ? wg_peer_name : client.wg_peer_name,
      router_model: router_model !== undefined ? router_model : client.router_model,
      notes: notes !== undefined ? notes : client.notes,
      subscription_end: subscription_end ?? client.subscription_end,
      status: status ?? client.status,
      is_free: is_free !== undefined ? (is_free ? 1 : 0) : (client.is_free || 0),
    };

    await dbRun(
      `UPDATE clients SET name=?, phone=?, wg_peer_id=?, wg_peer_name=?, router_model=?, notes=?, subscription_end=?, status=?, is_free=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [u.name, u.phone, u.wg_peer_id, u.wg_peer_name, u.router_model, u.notes, u.subscription_end, u.status, u.is_free, client.id]
    );
    res.json(await dbGet('SELECT * FROM clients WHERE id = ?', [client.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/:id/renew
router.post('/:id/renew', async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const days = parseInt(req.body.days || '30');
    const base = client.status === 'expired' || !client.subscription_end ? dayjs() : dayjs(client.subscription_end);
    const newEnd = base.add(days, 'day').format('YYYY-MM-DD');

    if (client.wg_peer_id) await enablePeer(client.wg_peer_id);
    await dbRun(`UPDATE clients SET subscription_end=?, status='active', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [newEnd, client.id]);

    res.json({ success: true, subscription_end: newEnd });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/:id/toggle
router.post('/:id/toggle', async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    if (!client.wg_peer_id) return res.status(400).json({ error: 'Нет привязанного WG пира' });

    if (req.body.action === 'enable') await enablePeer(client.wg_peer_id);
    else await disablePeer(client.wg_peer_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    await dbRun('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
