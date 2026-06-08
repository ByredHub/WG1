const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function requireAuth(req, res, next) {
  // Поддержка токена из query-параметра для SSE (EventSource не поддерживает заголовки)
  const queryToken = req.query.token;
  const authHeader = req.headers.authorization;

  if (!authHeader && !queryToken) return res.status(401).json({ error: 'Не авторизован' });

  const token = queryToken || authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен отсутствует' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Токен недействителен или истёк' });
  }
}

module.exports = { requireAuth };
