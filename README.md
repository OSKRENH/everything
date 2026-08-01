# Кутно

Веб-приложение: вводите продукты и кухонную технику, которые у вас есть, — приложение подбирает
рецепты и показывает пошаговые инструкции, отмечая, каких ингредиентов или техники не хватает.

Приложение развёрнуто на **Cloudflare Pages**: статический React-фронтенд + serverless API
(Cloudflare Pages Functions) + база данных **Cloudflare D1**. После одноразовой настройки (см. ниже)
каждый `git push` в подключённую ветку автоматически пересобирает и обновляет сайт.

## Стек

- **Frontend**: React + Vite, `react-router-dom`
- **Backend**: Cloudflare Pages Functions (serverless, файловая маршрутизация в `functions/`)
- **База данных**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite-совместимая),
  JWT-авторизация (`jose`), пароли хешируются PBKDF2 через Web Crypto API
- **Источник рецептов**: [Spoonacular API](https://spoonacular.com/food-api) — поиск по ингредиентам
  (`findByIngredients`) и пошаговые инструкции (`/recipes/{id}/information`, включая список техники
  на каждый шаг)

## Структура проекта

```
functions/
  api/
    auth/            register.js, login.js, me.js
    inventory/        index.js (GET/POST), [id].js (DELETE)
    recipes/           search.js, [id].js
  _shared/            jwt.js, password.js, users.js, inventory.js, spoonacular.js,
                       recipeCache.js, recipeMatching.js, auth.js, apiError.js
migrations/
  0001_init.sql        схема D1: users, inventory_items, recipe_cache
client/
  src/
    pages/              Login, Register, Inventory, Recipes, RecipeDetail
    components/         Navbar, InventoryList, RecipeCard, MissingEquipmentBanner, ProtectedRoute
    context/            AuthContext (JWT в localStorage)
    api/                обёртки над fetch для backend API
wrangler.toml           конфигурация Pages: имя проекта, привязка D1
```

## Локальный запуск

1. Клонируйте репозиторий и перейдите в его папку.
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Создайте файл `.dev.vars` в корне репозитория (он в `.gitignore`, не попадёт в git):
   ```
   JWT_SECRET=любая-случайная-строка
   SPOONACULAR_API_KEY=ваш_ключ_с_spoonacular.com
   ```
4. Примените схему базы данных к локальной (файловой) копии D1:
   ```bash
   npm run db:migrate:local
   ```
5. Запустите фронтенд и бэкенд вместе:
   ```bash
   npm run dev
   ```
   Это соберёт клиент и поднимет `vite` (с HMR, http://localhost:5173) и `wrangler pages dev`
   (Functions + D1, http://localhost:8788) параллельно — `vite` проксирует `/api/*` на 8788.
6. Откройте http://localhost:5173, зарегистрируйтесь, добавьте продукты/технику на странице
   «Инвентарь», перейдите в «Рецепты».

## Разворачивание на Cloudflare Pages (один раз)

Продовая база D1 (`kutno-db`) уже создана и мигрирована — `database_id` прописан в `wrangler.toml`.
Остался один шаг, который можно сделать только вручную в дашборде (OAuth-авторизация GitHub-приложения
Cloudflare — её нельзя выполнить через API):

1. **Подключите GitHub-репозиторий в Cloudflare Pages** (даёт автодеплой на каждый push):
   - Зайдите в Cloudflare Dashboard → **Workers & Pages** → **Create** → вкладка **Pages** →
     **Connect to Git**.
   - Выберите этот репозиторий и ветку (например, `main` или текущую рабочую ветку).
   - Параметры сборки:
     - **Build command**: `npm run build`
     - **Build output directory**: `client/dist`
     - **Root directory**: `/` (по умолчанию)
   - Нажмите **Save and Deploy** — Cloudflare соберёт и опубликует сайт на адресе вида
     `https://<project>.pages.dev`.
2. **Привяжите базу D1 к проекту Pages:**
   - В настройках проекта → **Settings → Functions → D1 database bindings** → **Add binding**.
   - **Variable name**: `DB` (обязательно точно так, код ссылается на `env.DB`).
   - **D1 database**: `kutno-db`.
3. **Добавьте секреты окружения:**
   - **Settings → Environment variables** → добавьте `JWT_SECRET` и `SPOONACULAR_API_KEY`,
     отметьте их как **Encrypt (secret)**.
4. **Пересоберите проект**, чтобы новые привязки и переменные подхватились: **Deployments** →
   на последнем деплое **⋯ → Retry deployment** (или просто сделайте новый `git push`).

После этого **любой push в подключённую ветку автоматически запускает новую сборку и деплой** —
никаких дополнительных действий не требуется.

## Ключ Spoonacular API

Без ключа приложение полностью работает (регистрация, вход, инвентарь), а разделы «Рецепты»
аккуратно показывают баннер «поиск рецептов недоступен» вместо ошибки.

Получить ключ: зарегистрируйтесь на https://spoonacular.com/food-api (бесплатный план — 150
запросов/день) и скопируйте API-ключ — впишите его в `.dev.vars` (локально) и в секреты Cloudflare
Pages (продакшн), см. выше.

**Важно:** Spoonacular распознаёт названия ингредиентов и техники в основном на английском языке.
Вводите продукты в инвентаре по-английски (`tomato`, `onion`, `chicken`, `oven`, `blender`) —
иначе поиск может не найти совпадений. Это ограничение внешнего API, не самого приложения.

## Как это устроено

- Инвентарь хранится в D1 и привязан к аккаунту пользователя (email + пароль, хэш PBKDF2, сессия —
  JWT со сроком действия 7 дней).
- Поиск рецептов: `GET /api/recipes/search` берёт список продуктов пользователя и одним запросом
  зовёт Spoonacular `findByIngredients`, возвращая карточки с процентом совпадения и списком
  недостающих ингредиентов.
- Детали рецепта: `GET /api/recipes/:id` подтягивает `analyzedInstructions` (шаги + техника на
  каждый шаг), сравнивает требуемую технику со списком пользователя и помечает шаги, для которых
  чего-то не хватает. Ответы Spoonacular кэшируются в таблице `recipe_cache` (30 дней), чтобы не
  тратить дневную квоту повторно на один и тот же рецепт.
- Функции без явного метода (`functions/api/[[catchall]].js`) отдают корректный JSON `404` для
  несуществующих `/api/*` маршрутов вместо SPA-фолбэка.

## Известные ограничения

- Известные security-advisory в `npm audit` (react-router RSC-режим CSRF, esbuild dev-server)
  относятся к режимам SSR/RSC/дев-серверу, которые это приложение не использует (чисто клиентский
  SPA через `BrowserRouter`).
- Названия продуктов/техники нужно вводить на английском для корректного поиска через Spoonacular
  (см. выше) — перевод на лету не реализован.
- Бесплатный тариф Spoonacular — 150 запросов/день на весь проект; при активном использовании
  несколькими людьми квота может закончиться раньше полуночи (по времени сброса Spoonacular).
