const bcrypt = require('bcryptjs');
const { run, getOne } = require('../config/db');

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NOT NULL,
      resetKeyHash VARCHAR(255) NULL,
      name VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await run('ALTER TABLE users ADD COLUMN resetKeyHash VARCHAR(255) NULL');
  } catch (error) {
    if (!/Duplicate column name/i.test(error.message)) throw error;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS passwordResetTokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      tokenHash CHAR(64) NOT NULL UNIQUE,
      expiresAt DATETIME NOT NULL,
      usedAt DATETIME NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      homeTeam VARCHAR(255) NOT NULL,
      awayTeam VARCHAR(255) NOT NULL,
      matchDate DATETIME NOT NULL,
      championship VARCHAR(255) NOT NULL,
      homeScore INT NULL,
      awayScore INT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      country VARCHAR(255) NOT NULL,
      stadium VARCHAR(255) NOT NULL,
      description TEXT NULL,
      roster TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await run('ALTER TABLE teams ADD COLUMN description TEXT NULL');
  } catch (error) {
    if (!/Duplicate column name/i.test(error.message)) throw error;
  }

  try {
    await run('ALTER TABLE teams ADD COLUMN roster TEXT NULL');
  } catch (error) {
    if (!/Duplicate column name/i.test(error.message)) throw error;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      category VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      matchId INT NOT NULL,
      UNIQUE KEY unique_favorite (userId, matchId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      matchId INT NOT NULL,
      ticketCode CHAR(16) NOT NULL UNIQUE,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      purchasedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_ticket (userId, matchId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function bootstrapAdmin() {
  const admin = await getOne('SELECT id FROM users WHERE email = ?', ['admin@football.local']);
  if (!admin) {
    const hash = await bcrypt.hash('Admin123!', 12);
    await run(
      'INSERT INTO users (email, passwordHash, name, role) VALUES (?, ?, ?, ?)',
      ['admin@football.local', hash, 'Администратор', 'admin']
    );
  }
}

async function seedInitialData() {
  const teamCount = await getOne('SELECT COUNT(*) AS count FROM teams');
  if (!teamCount || Number(teamCount.count) === 0) {
    await run(`
      INSERT INTO teams (name, country, stadium) VALUES
      ('Ливерпуль', 'Англия', 'Энфилд'),
      ('Манчестер Сити', 'Англия', 'Этихад'),
      ('Арсенал', 'Англия', 'Эмирейтс'),
      ('Челси', 'Англия', 'Стэмфорд Бридж');
    `);
  }

  const matchCount = await getOne('SELECT COUNT(*) AS count FROM matches');
  if (!matchCount || Number(matchCount.count) === 0) {
    await run(`
      INSERT INTO matches (homeTeam, awayTeam, matchDate, championship, homeScore, awayScore, status) VALUES
      ('Ливерпуль', 'Манчестер Сити', '2026-09-18 20:00:00', 'Премьер-лига', 2, 1, 'scheduled'),
      ('Ливерпуль', 'Арсенал', '2026-09-22 19:30:00', 'Премьер-лига', NULL, NULL, 'scheduled'),
      ('Ливерпуль', 'Челси', '2026-09-28 18:45:00', 'Кубок Англии', NULL, NULL, 'scheduled');
    `);
  }

  const newsCount = await getOne('SELECT COUNT(*) AS count FROM news');
  if (!newsCount || Number(newsCount.count) === 0) {
    await run(`
      INSERT INTO news (title, text, category) VALUES
      ('Ливерпуль стартует с новой яркой атакой', 'Команда поднимает темп и усиливает прессинг в начале сезона.', 'Клуб'),
      ('График матчей красных', 'Обновлено расписание важных встреч команды на ближайшие недели.', 'Матчи'),
      ('Новые лидеры в составе', 'Тренерский штаб отмечает рост молодых футболистов в атаке.', 'Трансферы');
    `);
  }
}

module.exports = { initDatabase, bootstrapAdmin, seedInitialData };
