# Football Hub

Учебный футбольный портал на JavaScript для лабораторных работ №2-4. В приложении есть регистрация, вход, защищенные страницы, новости, календарь матчей, команды, турниры, избранное и административное создание новостей.

## Стек

- Frontend: React, Vite, React Router, CSS
- Backend: Node.js, Express, Zod
- Database: MySQL 8
- Security: bcryptjs, JWT в httpOnly cookie, CORS, серверная и клиентская валидация
- Local deployment: Docker Compose

## Запуск локально

1. Установите Node.js 22+ и Docker Desktop.
2. Скопируйте репозиторий и установите зависимости:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

3. Создайте базу данных MySQL и выполните `backend/schema.sql`. Для локальной установки скопируйте `backend/.env.example` в `backend/.env` и заполните пароль MySQL.
4. В первом терминале запустите API:

```powershell
cd backend
npm run dev
```

5. Во втором терминале запустите клиент:

```powershell
cd frontend
npm run dev
```

Откройте http://localhost:5173. API доступно на http://localhost:4000/api.

### Вариант Docker

```powershell
docker compose up --build
```

После запуска клиент доступен на http://localhost:5173, API на http://localhost:4000.

## Основные маршруты frontend

- `/` главная страница и ближайшие матчи
- `/news` новости с поиском, фильтром категории и сортировкой
- `/matches` календарь с фильтром статуса
- `/teams` команды
- `/tournaments` турниры
- `/auth/login` вход
- `/auth/register` регистрация
- `/profile` приватный профиль
- `/favorites` приватное избранное
- `/admin` приватная панель администратора
- неизвестные URL показывают 404

## API

- `POST /api/auth/register` регистрация с Zod-валидацией и bcrypt-хешированием
- `POST /api/auth/login` вход и установка JWT cookie
- `POST /api/auth/logout` выход и очистка cookie
- `GET /api/auth/me` текущий пользователь
- `GET /api/news?search=&category=&sort=` список новостей
- `POST /api/news` создание новости, только admin
- `DELETE /api/news/:id` удаление новости, только admin
- `GET /api/matches?status=` список матчей
- `GET /api/teams` команды
- `GET /api/tournaments` турниры
- `POST /api/news/:id/favorite` добавить в избранное
- `DELETE /api/news/:id/favorite` удалить из избранного
- `GET /api/favorites` избранные новости текущего пользователя

Для создания администратора зарегистрируйте пользователя, затем в MySQL выполните `UPDATE users SET role = 'admin' WHERE email = 'your@email.com';`.

## Production

Перед публикацией задайте отдельные значения `JWT_SECRET`, `DB_PASSWORD`, `FRONTEND_URL`, `VITE_API_URL`, включите HTTPS и используйте managed MySQL. Подходящий вариант для учебного production-деплоя: frontend на Azure Static Web Apps или Vercel, backend на Azure App Service/Render, MySQL на Azure Database for MySQL или PlanetScale. Публичные ссылки появятся после выполнения деплоя с учетными данными облака.

## Проверка

```powershell
cd frontend
npm run build
cd ..\backend
node --check src/server.js
```
