# Football Platform

Полноценный JavaScript-проект футбольного сайта с:
- регистрацией и входом;
- ролями пользователя и администратора;
- защищёнными маршрутами;
- CRUD для матчей;
- MySQL в качестве базы данных;
- адаптивным интерфейсом.

## Быстрый запуск

1. Установите MySQL и создайте базу данных.
2. Создайте локальный файл `.env` и укажите свои данные:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=football_demo
JWT_SECRET=football-secret-key
PORT=3000
```

3. Установите зависимости:

```bash
npm install
```

4. Запустите проект:

```bash
npm start
```

5. Откройте в браузере:

```text
http://localhost:3000
```

## Данные администратора

- Email: admin@football.local
- Пароль: Admin123!

## Основные страницы

- `/` — главная
- `/auth/login` — вход
- `/auth/register` — регистрация
- `/profile` — личный кабинет
- `/matches` — матчи
- `/teams` — команды
- `/news` — новости
- `/favorites` — избранное
- `/admin` — панель администратора

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/matches`
- `POST /api/matches`
- `PUT /api/matches/:id`
- `DELETE /api/matches/:id`
- `GET /api/teams`
- `GET /api/news`
- `GET /api/favorites`
- `POST /api/favorites/:matchId`
- `DELETE /api/favorites/:matchId`

## Технологии

- JavaScript
- Node.js
- Express
- MySQL
- bcryptjs
- JWT
- HTML/CSS/JS frontend
