# Кутно

Веб-приложение: вводите продукты и кухонную технику, которые у вас есть, — приложение подбирает
рецепты и показывает пошаговые инструкции, отмечая, каких ингредиентов или техники не хватает.

## Стек

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`), JWT-авторизация
- **Frontend**: React + Vite, `react-router-dom`
- **Источник рецептов**: [Spoonacular API](https://spoonacular.com/food-api) — поиск по ингредиентам
  (`findByIngredients`) и пошаговые инструкции (`/recipes/{id}/information`, включая список техники
  на каждый шаг)

Репозиторий — npm workspaces с двумя пакетами: `server` и `client`.

## Быстрый старт

1. Клонируйте репозиторий и перейдите в его папку.
2. Выполните по очереди:
   ```bash
   npm install
   cp server/.env.example server/.env
   ```
3. Откройте `server/.env` в любом текстовом редакторе и впишите два значения:
   - `JWT_SECRET` — любая случайная строка (например, `openssl rand -hex 32`)
   - `SPOONACULAR_API_KEY` — ваш ключ с spoonacular.com (см. раздел ниже)
4. Запустите:
   ```bash
   npm run dev
   ```
5. Откройте http://localhost:5173 в браузере, зарегистрируйтесь, добавьте продукты/технику на
   странице «Инвентарь» и перейдите в «Рецепты».

## Ключ Spoonacular API

Без ключа приложение полностью работает (регистрация, вход, инвентарь), а разделы «Рецепты»
аккуратно показывают баннер «поиск рецептов недоступен» вместо ошибки.

Чтобы включить подбор рецептов:

1. Зарегистрируйтесь на https://spoonacular.com/food-api (бесплатный план — 150 запросов/день).
2. Скопируйте API-ключ.
3. Впишите его в `server/.env`:
   ```
   SPOONACULAR_API_KEY=ваш_ключ
   ```
4. Перезапустите сервер.

**Важно:** Spoonacular распознаёт названия ингредиентов и техники в основном на английском языке.
Вводите продукты в инвентаре по-английски (`tomato`, `onion`, `chicken`, `oven`, `blender`) —
иначе поиск может не найти совпадений. Это ограничение внешнего API, не самого приложения.

## Как это устроено

- Инвентарь хранится в SQLite (`server/data/app.db`) и привязан к аккаунту пользователя (email +
  пароль, хэш bcrypt, сессия — JWT).
- Поиск рецептов: `GET /api/recipes/search` берёт список продуктов пользователя и одним запросом
  зовёт Spoonacular `findByIngredients`, возвращая карточки с процентом совпадения и списком
  недостающих ингредиентов.
- Детали рецепта: `GET /api/recipes/:id` подтягивает `analyzedInstructions` (шаги + техника на
  каждый шаг), сравнивает требуемую технику со списком пользователя и помечает шаги, для которых
  чего-то не хватает. Ответы Spoonacular кэшируются в таблице `recipe_cache` (30 дней), чтобы не
  тратить дневную квоту повторно на один и тот же рецепт.

## Структура проекта

```
server/
  src/
    db/            schema.sql, подключение better-sqlite3
    routes/        auth, inventory, recipes
    services/      бизнес-логика (users, inventory, spoonacular client, recipe matching, cache)
    middleware/     JWT-аутентификация, обработка ошибок
client/
  src/
    pages/          Login, Register, Inventory, Recipes, RecipeDetail
    components/     Navbar, InventoryList, RecipeCard, MissingEquipmentBanner, ProtectedRoute
    context/        AuthContext (JWT в localStorage)
    api/            обёртки над fetch для backend API
```

## Известные ограничения

- Известные security-advisory в `npm audit` (react-router RSC-режим CSRF, esbuild dev-server,
  SSR-хэширование) относятся к режимам SSR/RSC/дев-серверу, которые это приложение не использует
  (чисто клиентский SPA через `BrowserRouter`, без SSR-рендеринга и без открытого наружу dev-сервера).
- Названия продуктов/техники нужно вводить на английском для корректного поиска через Spoonacular
  (см. выше) — перевод на лету не реализован.
