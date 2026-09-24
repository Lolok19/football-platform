const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Недействительный токен' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Доступ только для администратора' });
  }
  next();
}

function requireSameOrigin(req, res, next) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && !origin.endsWith(`://${host}`)) {
    return res.status(403).json({ message: 'Недопустимый источник запроса' });
  }
  next();
}

module.exports = { createToken, authRequired, adminRequired, requireSameOrigin };
