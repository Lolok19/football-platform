const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, getAll, run } = require('../config/db');
const { createToken, authRequired } = require('../middleware/auth');
const { validateEmail, validatePassword } = require('../utils/validators');

const router = express.Router();
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function isLoginBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordLoginFailure(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, startedAt: Date.now() });
    return;
  }
  entry.count += 1;
}

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
    const clientIp = req.ip;
    if (isLoginBlocked(clientIp)) {
      return res.status(429).json({ message: 'Слишком много попыток входа. Повторите через 15 минут' });
    }
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Введите email и пароль' });

    const user = await getOne('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (!user) {
      recordLoginFailure(clientIp);
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const match = await bcrypt.compare(String(password), user.passwordHash);
    if (!match) {
      recordLoginFailure(clientIp);
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    loginAttempts.delete(clientIp);
    const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
    return res.json({ user: safeUser, token: createToken(safeUser) });
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ message: 'Ошибка входа' });
  }
});

router.put('/me', authRequired, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (name.length < 2) return res.status(400).json({ message: 'Имя должно содержать минимум 2 символа' });

    const user = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    if (newPassword) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(400).json({ message: 'Текущий пароль указан неверно' });
      }
      if (!validatePassword(newPassword)) {
        return res.status(400).json({ message: 'Новый пароль должен содержать минимум 8 символов и спецсимвол' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await run('UPDATE users SET name = ?, passwordHash = ? WHERE id = ?', [name, passwordHash, req.user.id]);
    } else {
      await run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    }

    const updatedUser = await getOne('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [req.user.id]);
    return res.json({ user: updatedUser, token: createToken(updatedUser) });
  } catch (error) {
    console.error('profile update error', error);
    return res.status(500).json({ message: 'Не удалось обновить профиль' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const user = await getOne('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  return res.json(user);
});

module.exports = router;
