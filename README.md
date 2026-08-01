# Кутно

Веб-приложение: вводите продукты и кухонную технику, которые у вас есть, — приложение подбирает
рецепты и показывает пошаговые инструкции, отмечая, каких ингредиентов или техники не хватает.

Приложение развёрнуто на **Cloudflare Workers** (через git-интеграцию "Workers Builds"):
статический React-фронтенд + serverless API (собранные из Pages Functions в единый Worker) + база
данных **Cloudflare D1**. После одноразовой настройки (см. ниже) каждый `git push` в подключённую
ветку автоматически пересобирает и обновляет сайт.

## Стек

- **Frontend**: React + Vite, `react-router-dom`
- **Backend**: код в `functions/api/**` (файловая маршрутизация как в Pages Functions), при сборке
  компилируется в единый Cloudflare Worker (`wrangler pages functions build`) и деплоится через
  `wrangler deploy`
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
wrangler.jsonc           конфигурация Worker: имя проекта, entry point, привязка D1
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

## Разворачивание на Cloudflare Workers (один раз)

Продовая база D1 (`kutno-db`) уже создана и мигрирована — `database_id` прописан в `wrangler.jsonc`.
Проект `everything` на Cloudflare (Workers & Pages → everything) уже подключён к этому GitHub-репозиторию
с командами **Build command**: `npm run build`, **Deploy command**: `npx wrangler deploy` — их менять
не нужно.

**Важно — если первая сборка упала с ошибкой:** скорее всего, продакшн-ветка проекта в Cloudflare
указывает на `main`, а весь код приложения пока лежит только в ветке `claude/recipe-suggestion-app-dnkzxf`
(в `main` — только исходный пустой README). Проверьте и поправьте:

1. **Настройте ветку сборки:** Cloudflare Dashboard → **Workers & Pages → everything → Settings →
   Builds** → в разделе **Branch control** укажите продакшн-ветку `claude/recipe-suggestion-app-dnkzxf`
   (или сначала смёржите эту ветку в `main` и оставьте `main`, если предпочитаете так).
2. **Добавьте секреты окружения:** **Settings → Variables and Secrets** → добавьте `JWT_SECRET`
   (любая случайная строка) и `SPOONACULAR_API_KEY` (ваш ключ Spoonacular), отметьте оба как
   **Secret** (encrypted). Привязка D1 добавлять вручную не нужно — она уже описана в `wrangler.jsonc`
   и подхватывается автоматически при деплое.
3. **Запустите деплой заново:** **Deployments** → **Retry deployment** на последнем билде, либо
   сделайте новый `git push` в указанную ветку.

После этого **любой push в указанную ветку автоматически запускает новую сборку и деплой** — никаких
дополнительных действий не требуется.

## Ключ Spoonacular API

Без ключа приложение полностью работает (регистрация, вход, инвентарь), а разделы «Рецепты»
аккуратно показывают баннер «поиск рецептов недоступен» вместо ошибки.

Получить ключ: зарегистрируйтесь на https://spoonacular.com/food-api (бесплатный план — 150
запросов/день) и скопируйте API-ключ — впишите его в `.dev.vars` (локально) и в секреты проекта
Cloudflare Workers (продакшн), см. выше.

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
