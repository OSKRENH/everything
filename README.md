# Кутно

Веб-приложение: вводите продукты и кухонную технику, которые у вас есть, — приложение подбирает
рецепты и показывает пошаговые инструкции, отмечая, каких ингредиентов или техники не хватает.

Приложение открывается сразу, без регистрации — продукты и техника сохраняются в браузере
(localStorage). Регистрация (email/пароль или через Google) нужна только для того, чтобы сохранить
инвентарь в аккаунте и открывать его с других устройств; при первом входе локальные данные гостя
автоматически переносятся в аккаунт.

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
- **Вход через Google**: Google Identity Services на клиенте, ID-токен проверяется на бэкенде через
  JWKS Google (`jose`) — без клиентского секрета
- **Источник рецептов**: [Spoonacular API](https://spoonacular.com/food-api) — поиск по ингредиентам
  (`findByIngredients`) и пошаговые инструкции (`/recipes/{id}/information`, включая список техники
  на каждый шаг)

## Структура проекта

```
functions/
  api/
    config.js           публичный GET: {googleClientId} для фронтенда
    auth/                register.js, login.js, me.js, google.js (Google ID-token)
    inventory/           index.js (GET/POST), [id].js (DELETE) — только для аккаунтов
    recipes/              search.js, [id].js — без авторизации, список продуктов/техники
                          передаётся в теле запроса
  _shared/               jwt.js, password.js, users.js, inventory.js, spoonacular.js,
                          recipeCache.js, recipeMatching.js, auth.js, googleAuth.js, apiError.js
migrations/
  0001_init.sql           схема D1: users, inventory_items, recipe_cache
client/
  src/
    pages/                Login, Register, Inventory, Recipes, RecipeDetail
    components/           Navbar, InventoryList, RecipeCard, MissingEquipmentBanner,
                          GoogleSignInButton
    context/              AuthContext (JWT в localStorage, миграция гостевых данных при входе)
    api/                  обёртки над fetch для backend API + guestInventory.js (localStorage),
                          inventoryStore.js (выбирает backend/localStorage по статусу входа)
wrangler.jsonc            конфигурация Worker: имя проекта, entry point, привязка D1, SPA-фолбэк
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

## Вход через Google (опционально)

Без настройки кнопка «Войти через Google» просто не показывается на страницах входа/регистрации —
всё остальное (email/пароль, гостевой режим) работает как обычно. Чтобы включить:

1. Откройте [Google Cloud Console](https://console.cloud.google.com/) → создайте проект (или
   выберите существующий).
2. **APIs & Services → OAuth consent screen** — настройте экран согласия (тип **External**,
   заполните название приложения и контактный email; для личного использования публиковать
   приложение не обязательно, можно оставить в статусе Testing и добавить свой email в тестовые
   пользователи).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - **Application type**: Web application
   - **Authorized JavaScript origins**: `https://everything.ivankamaldinov.workers.dev`
     (и `http://localhost:5173`, если хотите проверять вход через Google локально)
4. Скопируйте **Client ID** (выглядит как `...apps.googleusercontent.com`; Client Secret не нужен —
   используется схема ID-токена без секрета).
5. Добавьте его как переменную окружения проекта:
   - **Продакшн**: Cloudflare Dashboard → **Workers & Pages → everything → Settings → Variables
     and Secrets** → добавьте `GOOGLE_CLIENT_ID` (шифровать как секрет не обязательно, значение не
     чувствительное) → **Retry deployment**, чтобы подхватилось.
   - **Локально**: добавьте `GOOGLE_CLIENT_ID=...` в `.dev.vars`.

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

- **Гостевой режим:** без входа список продуктов и техники хранится в `localStorage` браузера
  (`client/src/api/guestInventory.js`). `inventoryStore.js` прозрачно переключается между
  localStorage (гость) и D1-бэкендом (вход выполнен) — страницы инвентаря/рецептов не знают,
  откуда пришли данные. При успешном входе/регистрации (`AuthContext.jsx`) гостевые записи
  автоматически переносятся в аккаунт через `POST /api/inventory` и локальная копия очищается.
- **Рецепты не требуют авторизации:** `POST /api/recipes/search` и `POST /api/recipes/:id` берут
  список продуктов/техники прямо из тела запроса (а не из аккаунта на сервере), поэтому работают
  одинаково для гостей и вошедших пользователей — ключ Spoonacular всё равно остаётся только на
  сервере. `search` возвращает карточки с процентом совпадения и списком недостающих ингредиентов;
  `:id` подтягивает `analyzedInstructions` (шаги + техника на каждый шаг) и помечает шаги, для
  которых не хватает техники. Ответы Spoonacular кэшируются в таблице `recipe_cache` (30 дней),
  чтобы не тратить дневную квоту повторно на один и тот же рецепт.
- **Аккаунты:** email + пароль (хэш PBKDF2) или вход через Google (ID-токен проверяется на бэкенде
  через JWKS Google, без клиентского секрета) — в обоих случаях выдаётся собственный JWT на 7 дней.
  Инвентарь аккаунта хранится в D1 (`inventory_items`), доступен только через `/api/inventory` под
  авторизацией.
- Функции без явного метода (`functions/api/[[catchall]].js`) отдают корректный JSON `404` для
  несуществующих `/api/*` маршрутов вместо SPA-фолбэка; для клиентских маршрутов (`/inventory`,
  `/recipes/...`) SPA-фолбэк включён через `assets.not_found_handling` в `wrangler.jsonc`.

## Известные ограничения

- Известные security-advisory в `npm audit` (react-router RSC-режим CSRF, esbuild dev-server)
  относятся к режимам SSR/RSC/дев-серверу, которые это приложение не использует (чисто клиентский
  SPA через `BrowserRouter`).
- Названия продуктов/техники нужно вводить на английском для корректного поиска через Spoonacular
  (см. выше) — перевод на лету не реализован.
- Бесплатный тариф Spoonacular — 150 запросов/день на весь проект; при активном использовании
  несколькими людьми квота может закончиться раньше полуночи (по времени сброса Spoonacular).
- Гостевые данные хранятся только в текущем браузере (localStorage) — очистка данных сайта или
  смена браузера/устройства их сотрёт. Единственный способ сохранить их надёжно — зарегистрироваться
  или войти через Google до того, как это произойдёт.
- Аккаунт, созданный через Google, не получает пароль — войти в него по email/паролю нельзя (это
  ожидаемо: `password_hash` для таких аккаунтов — заглушка, которая не совпадёт ни с одним паролем).
