const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./src/config/env');
const { ensureDatabase } = require('./src/config/db');
const { initDatabase, bootstrapAdmin, seedInitialData } = require('./src/db/schema');
const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.get(['/', '/auth/:page', '/profile', '/matches', '/teams', '/news', '/favorites', '/admin', '/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'views', 'index.html'));
});

app.use((req, res) => {
  res.status(404).send('<h1>404</h1><p>Страница не найдена</p>');
});

async function start() {
  try {
    await ensureDatabase();
    await initDatabase();
    await bootstrapAdmin();
    await seedInitialData();

    app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
      console.log('Администратор: admin@football.local / Admin123!');
    });
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

start();
