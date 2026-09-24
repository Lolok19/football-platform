const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getAll, getOne, run } = require('../config/db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { validatePassword } = require('../utils/validators');

const router = express.Router();
const imageUpload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

router.post('/uploads', authRequired, adminRequired, imageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Выберите изображение JPG, PNG, WEBP или GIF до 5 МБ' });
  const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  const extension = extensions[req.file.mimetype] || '.bin';
  const fileName = `${req.file.filename}${extension}`;
  fs.renameSync(req.file.path, path.join(path.dirname(req.file.path), fileName));
  return res.status(201).json({ imageUrl: `/uploads/${fileName}` });
});

router.get('/health', async (req, res) => {
  try {
    const result = await getOne('SELECT 1 AS ok');
    res.json({ ok: !!result, message: 'API работает', db: 'mysql' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Ошибка подключения к MySQL' });
  }
});

router.get('/teams', async (req, res) => {
  const rows = await getAll('SELECT * FROM teams ORDER BY name ASC');
  return res.json(rows);
});

router.get('/teams/:id/roster', async (req, res) => {
  const team = await getOne('SELECT id, name, roster FROM teams WHERE id = ?', [Number(req.params.id)]);
  if (!team) return res.status(404).json({ message: 'Команда не найдена' });
  return res.json({ id: team.id, name: team.name, roster: team.roster || '' });
});

router.get('/news', async (req, res) => {
  const rows = await getAll('SELECT * FROM news ORDER BY createdAt DESC');
  return res.json(rows);
});

router.get('/matches', async (req, res) => {
  const { search = '', championship = '', sort = 'date' } = req.query;
  let sql = 'SELECT * FROM matches WHERE 1 = 1';
  const params = [];

  if (search) {
    sql += ' AND (homeTeam LIKE ? OR awayTeam LIKE ?)';
    params.push(`%${String(search)}%`, `%${String(search)}%`);
  }

  if (championship) {
    sql += ' AND championship = ?';
    params.push(String(championship));
  }

  sql += sort === 'name' ? ' ORDER BY homeTeam ASC' : ' ORDER BY matchDate ASC';
  const rows = await getAll(sql, params);
  return res.json(rows);
});

router.get('/users', authRequired, adminRequired, async (req, res) => {
  const rows = await getAll('SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt DESC');
  return res.json(rows);
});

router.post('/users', authRequired, adminRequired, async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: 'Заполните email, имя и пароль' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || !validatePassword(password)) {
      return res.status(400).json({ message: 'Проверьте email и пароль: минимум 8 символов и спецсимвол' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await getOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) return res.status(409).json({ message: 'Пользователь уже существует' });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const result = await run('INSERT INTO users (email, passwordHash, name, role) VALUES (?, ?, ?, ?)', [normalizedEmail, passwordHash, String(name).trim(), role === 'admin' ? 'admin' : 'user']);
    const user = await getOne('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [result.insertId]);
    return res.status(201).json(user);
  } catch (error) {
    console.error('create user error', error);
    return res.status(500).json({ message: 'Ошибка создания пользователя' });
  }
});

router.delete('/users/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (req.user.id === userId) return res.status(400).json({ message: 'Нельзя удалить себя' });
    const result = await run('DELETE FROM users WHERE id = ?', [userId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Пользователь не найден' });
    return res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    console.error('delete user error', error);
    return res.status(500).json({ message: 'Ошибка удаления пользователя' });
  }
});

router.post('/teams', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, country, stadium, description = '', roster = '', imageUrl = '' } = req.body;
    if (!name || !country || !stadium) return res.status(400).json({ message: 'Заполните название, страну и стадион' });

    const result = await run('INSERT INTO teams (name, country, stadium, description, roster, imageUrl) VALUES (?, ?, ?, ?, ?, ?)', [String(name).trim(), String(country).trim(), String(stadium).trim(), String(description).trim(), String(roster).trim(), String(imageUrl).trim()]);
    const team = await getOne('SELECT * FROM teams WHERE id = ?', [result.insertId]);
    return res.status(201).json(team);
  } catch (error) {
    console.error('create team error', error);
    return res.status(500).json({ message: 'Ошибка создания команды' });
  }
});

router.put('/teams/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, country, stadium, description = '', roster = '', imageUrl = '' } = req.body;
    if (!name || !country || !stadium) return res.status(400).json({ message: 'Заполните название, страну и стадион' });

    const result = await run(
      'UPDATE teams SET name = ?, country = ?, stadium = ?, description = ?, roster = ?, imageUrl = ? WHERE id = ?',
      [String(name).trim(), String(country).trim(), String(stadium).trim(), String(description).trim(), String(roster).trim(), String(imageUrl).trim(), Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Команда не найдена' });
    return res.json(await getOne('SELECT * FROM teams WHERE id = ?', [Number(req.params.id)]));
  } catch (error) {
    console.error('update team error', error);
    return res.status(500).json({ message: 'Ошибка редактирования команды' });
  }
});

router.delete('/teams/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const result = await run('DELETE FROM teams WHERE id = ?', [teamId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Команда не найдена' });
    return res.json({ message: 'Команда удалена' });
  } catch (error) {
    console.error('delete team error', error);
    return res.status(500).json({ message: 'Ошибка удаления команды' });
  }
});

router.put('/news/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { title, text, category, imageUrl = '' } = req.body;
    if (!title || !text || !category) return res.status(400).json({ message: 'Заполните заголовок, текст и категорию' });

    const result = await run('UPDATE news SET title = ?, text = ?, category = ?, imageUrl = ? WHERE id = ?', [String(title).trim(), String(text).trim(), String(category).trim(), String(imageUrl).trim(), Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Новость не найдена' });

    const news = await getOne('SELECT * FROM news WHERE id = ?', [Number(req.params.id)]);
    return res.json(news);
  } catch (error) {
    console.error('update news error', error);
    return res.status(500).json({ message: 'Ошибка редактирования новости' });
  }
});

router.post('/news', authRequired, adminRequired, async (req, res) => {
  try {
    const { title, text, category, imageUrl = '' } = req.body;
    if (!title || !text || !category) return res.status(400).json({ message: 'Заполните заголовок, текст и категорию' });

    const result = await run(
      'INSERT INTO news (title, text, category, imageUrl) VALUES (?, ?, ?, ?)',
      [String(title).trim(), String(text).trim(), String(category).trim(), String(imageUrl).trim()]
    );
    return res.status(201).json(await getOne('SELECT * FROM news WHERE id = ?', [result.insertId]));
  } catch (error) {
    console.error('create news error', error);
    return res.status(500).json({ message: 'Ошибка создания новости' });
  }
});

router.delete('/news/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const newsId = Number(req.params.id);
    const result = await run('DELETE FROM news WHERE id = ?', [newsId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Новость не найдена' });
    return res.json({ message: 'Новость удалена' });
  } catch (error) {
    console.error('delete news error', error);
    return res.status(500).json({ message: 'Ошибка удаления новости' });
  }
});

router.post('/matches', authRequired, adminRequired, async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, championship, homeScore, awayScore, status } = req.body;
    if (!homeTeam || !awayTeam || !matchDate || !championship) return res.status(400).json({ message: 'Заполните обязательные поля' });

    const result = await run(
      `INSERT INTO matches (homeTeam, awayTeam, matchDate, championship, homeScore, awayScore, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(homeTeam).trim(), String(awayTeam).trim(), String(matchDate), String(championship).trim(), homeScore ?? null, awayScore ?? null, status || 'scheduled']
    );

    const created = await getOne('SELECT * FROM matches WHERE id = ?', [result.insertId]);
    return res.status(201).json(created);
  } catch (error) {
    console.error('create match error', error);
    return res.status(500).json({ message: 'Ошибка создания матча' });
  }
});

router.put('/matches/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchDate, championship, homeScore, awayScore, status } = req.body;
    const result = await run(
      `UPDATE matches SET homeTeam = ?, awayTeam = ?, matchDate = ?, championship = ?, homeScore = ?, awayScore = ?, status = ? WHERE id = ?`,
      [String(homeTeam).trim(), String(awayTeam).trim(), String(matchDate), String(championship).trim(), homeScore ?? null, awayScore ?? null, status || 'scheduled', Number(req.params.id)]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Матч не найден' });
    const updated = await getOne('SELECT * FROM matches WHERE id = ?', [Number(req.params.id)]);
    return res.json(updated);
  } catch (error) {
    console.error('update match error', error);
    return res.status(500).json({ message: 'Ошибка обновления матча' });
  }
});

router.delete('/matches/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await run('DELETE FROM matches WHERE id = ?', [Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Матч не найден' });
    return res.json({ message: 'Матч удалён' });
  } catch (error) {
    console.error('delete match error', error);
    return res.status(500).json({ message: 'Ошибка удаления матча' });
  }
});

router.post('/tickets/:matchId', authRequired, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await getOne('SELECT id, homeTeam, awayTeam, matchDate, status FROM matches WHERE id = ?', [matchId]);
    if (!match) return res.status(404).json({ message: 'Матч не найден' });
    if (match.status === 'finished' || new Date(match.matchDate) <= new Date()) {
      return res.status(400).json({ message: 'Продажа билетов на этот матч завершена' });
    }

    const existing = await getOne('SELECT id, ticketCode, price, purchasedAt FROM tickets WHERE userId = ? AND matchId = ?', [req.user.id, matchId]);
    if (existing) return res.status(409).json({ message: 'Билет на этот матч уже куплен', ticket: existing });

    const ticketCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    const result = await run('INSERT INTO tickets (userId, matchId, ticketCode, price) VALUES (?, ?, ?, ?)', [req.user.id, matchId, ticketCode, Number(req.body.price || 0)]);
    const ticket = await getOne('SELECT t.id, t.ticketCode, t.price, t.purchasedAt, m.homeTeam, m.awayTeam, m.matchDate FROM tickets t INNER JOIN matches m ON m.id = t.matchId WHERE t.id = ?', [result.insertId]);
    return res.status(201).json(ticket);
  } catch (error) {
    console.error('buy ticket error', error);
    return res.status(500).json({ message: 'Не удалось купить билет' });
  }
});

router.get('/tickets', authRequired, async (req, res) => {
  const tickets = await getAll(
    `SELECT t.id, t.ticketCode, t.price, t.purchasedAt, m.homeTeam, m.awayTeam, m.matchDate
     FROM tickets t INNER JOIN matches m ON m.id = t.matchId
     WHERE t.userId = ? ORDER BY m.matchDate ASC`,
    [req.user.id]
  );
  return res.json(tickets);
});

router.get('/favorites', authRequired, async (req, res) => {
  const rows = await getAll(
    `SELECT m.* FROM favorites f
     INNER JOIN matches m ON m.id = f.matchId
     WHERE f.userId = ? ORDER BY m.matchDate ASC`,
    [req.user.id]
  );
  return res.json(rows);
});

router.post('/favorites/:matchId', authRequired, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    await run('INSERT INTO favorites (userId, matchId) VALUES (?, ?)', [req.user.id, matchId]);
    return res.status(201).json({ message: 'Матч добавлен в избранное' });
  } catch (error) {
    return res.status(409).json({ message: 'Матч уже в избранном' });
  }
});

router.delete('/favorites/:matchId', authRequired, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const result = await run('DELETE FROM favorites WHERE userId = ? AND matchId = ?', [req.user.id, matchId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Матч не найден в избранном' });
    return res.json({ message: 'Матч удалён из избранного' });
  } catch (error) {
    return res.status(500).json({ message: 'Ошибка удаления из избранного' });
  }
});

module.exports = router;
