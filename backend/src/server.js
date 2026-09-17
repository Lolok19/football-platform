import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { requireAdmin, requireAuth } from './middleware.js';
import { loginSchema, newsSchema, registerSchema } from './validation.js';

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 4000);
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 };

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
}
function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function validationError(error) {
  return error?.issues?.[0]?.message || 'Проверьте введенные данные';
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'error', message: 'База данных недоступна' }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [data.email.toLowerCase()]);
    if (existing.length) return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    const passwordHash = await bcrypt.hash(data.password, 12);
    const [result] = await pool.query('INSERT INTO users (email, passwordHash, name) VALUES (?, ?, ?)', [data.email.toLowerCase(), passwordHash, data.name]);
    const user = { id: result.insertId, email: data.email.toLowerCase(), name: data.name, role: 'user' };
    res.cookie('football_token', issueToken(user), cookieOptions).status(201).json({ user });
  } catch (error) { res.status(error?.issues ? 400 : 500).json({ message: error?.issues ? validationError(error) : 'Не удалось зарегистрировать пользователя' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [data.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ message: 'Неверный email или пароль' });
    res.cookie('football_token', issueToken(user), cookieOptions).json({ user: publicUser(user) });
  } catch (error) { res.status(error?.issues ? 400 : 500).json({ message: error?.issues ? validationError(error) : 'Не удалось войти' }); }
});

app.post('/api/auth/logout', (_req, res) => { res.clearCookie('football_token', cookieOptions).json({ message: 'Вы вышли из системы' }); });
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ message: 'Пользователь не найден' });
  res.json({ user: rows[0] });
});

app.get('/api/news', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  const params = [];
  const conditions = [];
  if (search) { conditions.push('(title LIKE ? OR excerpt LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM news ${where} ORDER BY publishedAt ${sort}`, params);
  res.json({ items: rows });
});

app.get('/api/matches', async (req, res) => {
  const status = ['scheduled', 'live', 'finished'].includes(req.query.status) ? req.query.status : null;
  const [rows] = await pool.query(status ? 'SELECT * FROM matches WHERE status = ? ORDER BY matchDate' : 'SELECT * FROM matches ORDER BY matchDate', status ? [status] : []);
  res.json({ items: rows });
});

app.get('/api/teams', (_req, res) => res.json({ items: [
  { id: 1, name: 'North City', shortName: 'NC', city: 'Северный город', league: 'Premier League' },
  { id: 2, name: 'Red United', shortName: 'RU', city: 'Редфорд', league: 'Premier League' },
  { id: 3, name: 'Blue Harbor', shortName: 'BH', city: 'Блу Харбор', league: 'National Cup' },
  { id: 4, name: 'Capital FC', shortName: 'CF', city: 'Столица', league: 'National Cup' },
  { id: 5, name: 'River Town', shortName: 'RT', city: 'Ривертаун', league: 'Premier League' },
  { id: 6, name: 'Athletic 1908', shortName: 'A8', city: 'Олдтаун', league: 'Premier League' }
] }));
app.get('/api/tournaments', (_req, res) => res.json({ items: [
  { id: 1, name: 'Premier League', season: '2026 / 27', description: 'Главный национальный чемпионат с еженедельными турами.', teams: 20 },
  { id: 2, name: 'National Cup', season: '2026', description: 'Кубковый турнир, где встречаются клубы разных дивизионов.', teams: 64 },
  { id: 3, name: 'City Championship', season: 'Лето 2026', description: 'Открытый городской турнир для любительских команд.', teams: 16 }
] }));

app.post('/api/news/:id/favorite', requireAuth, async (req, res) => {
  const newsId = Number(req.params.id);
  await pool.query('INSERT IGNORE INTO favorites (userId, newsId) VALUES (?, ?)', [req.user.id, newsId]);
  res.status(201).json({ favorite: true });
});
app.delete('/api/news/:id/favorite', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM favorites WHERE userId = ? AND newsId = ?', [req.user.id, Number(req.params.id)]);
  res.json({ favorite: false });
});
app.get('/api/favorites', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT news.* FROM news JOIN favorites ON favorites.newsId = news.id WHERE favorites.userId = ? ORDER BY favorites.createdAt DESC', [req.user.id]);
  res.json({ items: rows });
});

app.post('/api/news', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = newsSchema.parse(req.body);
    const [result] = await pool.query('INSERT INTO news (title, excerpt, category, imageUrl) VALUES (?, ?, ?, ?)', [data.title, data.excerpt, data.category, data.imageUrl || null]);
    const [rows] = await pool.query('SELECT * FROM news WHERE id = ?', [result.insertId]);
    res.status(201).json({ item: rows[0] });
  } catch (error) { res.status(error?.issues ? 400 : 500).json({ message: error?.issues ? validationError(error) : 'Не удалось создать новость' }); }
});
app.delete('/api/news/:id', requireAuth, requireAdmin, async (req, res) => { await pool.query('DELETE FROM news WHERE id = ?', [Number(req.params.id)]); res.status(204).end(); });

app.use((_req, res) => res.status(404).json({ message: 'API-маршрут не найден' }));
app.listen(port, () => console.log(`Football Hub API running on http://localhost:${port}`));
