const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Не авторизован' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ username: decoded.username, role: decoded.role });
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
});

module.exports = router;
