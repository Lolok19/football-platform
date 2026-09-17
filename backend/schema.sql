CREATE DATABASE IF NOT EXISTS football_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE football_hub;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  homeTeam VARCHAR(100) NOT NULL,
  awayTeam VARCHAR(100) NOT NULL,
  league VARCHAR(100) NOT NULL,
  matchDate DATETIME NOT NULL,
  homeScore TINYINT UNSIGNED NULL,
  awayScore TINYINT UNSIGNED NULL,
  status ENUM('scheduled', 'live', 'finished') NOT NULL DEFAULT 'scheduled',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  excerpt TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  imageUrl VARCHAR(500) NULL,
  publishedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  userId INT UNSIGNED NOT NULL,
  newsId INT UNSIGNED NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, newsId),
  CONSTRAINT favorites_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT favorites_news_fk FOREIGN KEY (newsId) REFERENCES news(id) ON DELETE CASCADE
);

INSERT INTO news (title, excerpt, category, imageUrl)
SELECT * FROM (
  SELECT 'Финал сезона: команды готовятся к решающему матчу' AS title, 'Главные тренеры поделились планами и составами перед центральной игрой тура.', 'Матч дня' AS category, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80' AS imageUrl
  UNION ALL SELECT 'Молодые таланты меняют европейский футбол', 'Разбираем игроков, которые уже стали ключевыми фигурами своих клубов.', 'Аналитика', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=80'
  UNION ALL SELECT 'Открыта регистрация на летний турнир', 'Любительские команды могут подать заявку и сыграть на главной арене города.', 'События', 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=900&q=80'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM news LIMIT 1);

INSERT INTO matches (homeTeam, awayTeam, league, matchDate, status)
SELECT * FROM (
  SELECT 'North City', 'Red United', 'Premier League', DATE_ADD(NOW(), INTERVAL 2 DAY), 'scheduled'
  UNION ALL SELECT 'Blue Harbor', 'Capital FC', 'National Cup', DATE_ADD(NOW(), INTERVAL 4 DAY), 'scheduled'
  UNION ALL SELECT 'River Town', 'Athletic 1908', 'Premier League', DATE_SUB(NOW(), INTERVAL 1 DAY), 'finished'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM matches LIMIT 1);
