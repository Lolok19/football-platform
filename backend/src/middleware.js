import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies.football_token;
  if (!token) return res.status(401).json({ message: 'Требуется авторизация' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('football_token');
    res.status(401).json({ message: 'Сессия истекла' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Нужны права администратора' });
  next();
}
