const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, getAll, run } = require('../config/db');
const { createToken, authRequired } = require('../middleware/auth');
const { validateEmail, validatePassword } = require('../utils/validators');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, resetKeyword } = req.body;
    if (!email || !password || !name || !resetKeyword) return res.status(400).json({ message: 'Заполните все поля, включая секретное слово' });
    if (!validateEmail(email)) return res.status(400).json({ message: 'Введите корректный email' });
    if (!validatePassword(password)) return res.status(400).json({ message: 'Пароль должен содержать минимум 8 символов и хотя бы один спецсимвол' });
    if (String(resetKeyword).trim().length < 3) return res.status(400).json({ message: 'Секретное слово должно содержать минимум 3 символа' });

    const existing = await getOne('SELECT id FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (existing) return res.status(409).json({ message: 'Пользователь уже существует' });
    const usersWithKeys = await getAll('SELECT id FROM users WHERE resetKeyHash IS NOT NULL');
    for (const candidate of usersWithKeys) {
      const candidateUser = await getOne('SELECT resetKeyHash FROM users WHERE id = ?', [candidate.id]);
      if (candidateUser && await bcrypt.compare(String(resetKeyword).trim().toLowerCase(), candidateUser.resetKeyHash)) {
        return res.status(409).json({ message: 'Это секретное слово уже используется, придумайте другое' });
      }
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    const resetKeyHash = await bcrypt.hash(String(resetKeyword).trim().toLowerCase(), 12);
    const result = await run('INSERT INTO users (email, passwordHash, resetKeyHash, name) VALUES (?, ?, ?, ?)', [String(email).trim().toLowerCase(), passwordHash, resetKeyHash, String(name).trim()]);
    const user = await getOne('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [result.insertId]);

    return res.status(201).json({ user, token: createToken(user) });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ message: 'Ошибка регистрации' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const resetKeyword = String(req.body.resetKeyword || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!resetKeyword || !password) return res.status(400).json({ message: 'Введите секретное слово и новый пароль' });
    if (!validatePassword(password)) return res.status(400).json({ message: 'Пароль должен содержать минимум 8 символов и хотя бы один спецсимвол' });

    const users = await getAll('SELECT id, resetKeyHash FROM users WHERE resetKeyHash IS NOT NULL');
    let user = null;
    for (const candidate of users) {
      if (await bcrypt.compare(resetKeyword, candidate.resetKeyHash)) {
        user = candidate;
        break;
      }
    }
    if (!user) {
      return res.status(400).json({ message: 'Неверное секретное слово' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, user.id]);
    return res.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    console.error('forgot password error', error);
    return res.status(500).json({ message: 'Не удалось изменить пароль' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Введите email и пароль' });

    const user = await getOne('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (!user) return res.status(401).json({ message: 'Неверный email или пароль' });

    const match = await bcrypt.compare(String(password), user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Неверный email или пароль' });

    const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
    return res.json({ user: safeUser, token: createToken(safeUser) });
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ message: 'Ошибка входа' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const user = await getOne('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  return res.json(user);
});

module.exports = router;
