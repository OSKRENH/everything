#!/usr/bin/env node
/**
 * Регрессионный набор для kutno.ru
 *
 *   node kutno-tests.mjs                      # против https://kutno.ru
 *   node kutno-tests.mjs http://localhost:8787
 *
 * Код возврата 1, если есть падения уровня P0 или P1.
 */

const BASE = (process.argv[2] || 'https://kutno.ru').replace(/\/$/, '');
const results = [];
let checks = 0;

const record = (sev, area, name, ok, detail = '') => {
  checks++;
  results.push({ sev, area, name, ok, detail });
  const mark = ok ? '  ok  ' : ` ${sev}  `;
  console.log(`${mark} ${area} · ${name}${detail ? ' — ' + detail : ''}`);
};

async function get(path, init = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...init });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json, headers: Object.fromEntries(res.headers) };
}

async function post(path, body) {
  return get(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const generate = (ingredients, extra = {}) => post('/api/generate', { ingredients, ...extra });

async function testHealth() {
  const r = await get('/api/health');
  record('P0', 'здоровье', 'GET /api/health', r.status === 200 && r.json?.ok === true, `статус ${r.status}`);
}

async function testCacheHeaders() {
  const mustBeNoStore = [
    '/api/catalog',
    '/api/catalog-index',
    '/api/photo-manifest',
    '/api/matching-suggestions',
    '/api/health',
    '/api/config',
  ];
  for (const path of mustBeNoStore) {
    const r = await get(path);
    const cc = r.headers['cache-control'] || '';
    const browserCached = /max-age=[1-9]/.test(cc) && !/no-store/.test(cc);
    record('P0', 'кэш', `${path} не кэшируется браузером`, !browserCached, cc || '(заголовка нет)');
  }
  const sm = await get('/sitemap.xml');
  record('P1', 'кэш', '/sitemap.xml отдаётся свежим', /no-store/.test(sm.headers['cache-control'] || ''), sm.headers['cache-control'] || '');
}

async function testCatalog() {
  const first = await get('/api/catalog');
  const total = first.json?.total || 0;
  record('P0', 'каталог', 'total больше 200', total > 200, `total=${total}`);
  record('P1', 'каталог', 'страница по умолчанию не куцая', (first.json?.recipes || []).length >= 12,
    `отдано ${(first.json?.recipes || []).length}, limit=${first.json?.limit}`);

  let cursor = '', seen = new Set(), pages = 0;
  while (pages < 100) {
    const r = await get(`/api/catalog?limit=12${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    const rs = r.json?.recipes || [];
    if (!rs.length) break;
    rs.forEach(x => seen.add(x.id));
    pages++;
    cursor = r.json?.nextCursor || '';
    if (!cursor) break;
  }
  record('P1', 'каталог', 'обход курсором покрывает весь каталог', seen.size === total, `собрано ${seen.size} из ${total}`);

  for (const [q] of [['?limit=0'], ['?limit=-5'], ['?limit=abc'], ['?limit=99999'], ['?cursor=мусор']]) {
    const r = await get('/api/catalog' + q);
    const n = (r.json?.recipes || []).length;
    record('P2', 'каталог', `${q} обрабатывается корректно`, r.status === 200 && n >= 1, `${r.status}, ${n} рец., limit=${r.json?.limit}`);
  }
}

async function testIndex() {
  const r = await get('/api/catalog-index');
  const idx = r.json?.index || [];
  record('P0', 'индекс', 'индекс непустой', idx.length > 200, `${idx.length} записей`);

  const ids = idx.map(x => x.id);
  record('P0', 'данные', 'нет дублирующихся id', new Set(ids).size === ids.length);

  const titles = idx.map(x => x.title);
  record('P1', 'данные', 'нет дублирующихся названий', new Set(titles).size === titles.length,
    `уникальных ${new Set(titles).size} из ${titles.length}`);

  record('P1', 'данные', 'у всех есть ингредиенты', idx.every(x => (x.ingredients || []).length > 0));
  record('P2', 'данные', 'у всех задано время', idx.every(x => Number(x.minutes) > 0));
  record('P2', 'данные', 'у всех есть кухня и тип блюда', idx.every(x => x.cuisine && x.course));
  return idx;
}

async function testPhotos(idx) {
  const man = (await get('/api/photo-manifest')).json?.photos || [];
  const flagged = idx.filter(x => x.hasPhoto);
  record('P1', 'фото', 'манифест совпадает с индексом', man.length === flagged.length,
    `манифест ${man.length}, индекс ${flagged.length}`);
  record('P0', 'фото', 'у каждой карточки с фото есть URL', flagged.every(x => x.photo?.page));

  const gen = await generate(['яйца', 'картошка', 'лук']);
  const withPhoto = (gen.json?.recipes || []).filter(x => x.hasPhoto).length;
  record('P0', 'фото', 'подбор отдаёт карточки с фото', withPhoto > 0, `${withPhoto} из ${(gen.json?.recipes || []).length}`);

  const sample = flagged.slice(0, 5);
  for (const e of sample) {
    for (const url of [e.photo?.square, e.photo?.page, e.photo?.social].filter(Boolean)) {
      const res = await fetch(url, { method: 'HEAD' });
      const type = res.headers.get('content-type') || '';
      record('P1', 'фото', `файл существует: ${url.split('/').pop()}`,
        res.ok && /image\//.test(type), `${res.status} ${type}`);
    }
  }
}

const REGRESSION_SETS = [
  ['яйца', 'картошка', 'лук'],
  ['курица', 'рис', 'морковь'],
  ['макароны', 'сыр', 'яйца'],
  ['картошка', 'лук', 'морковь', 'масло'],
  ['помидоры', 'огурцы', 'сметана'],
  ['гречка', 'лук', 'морковь'],
  ['яйца', 'молоко', 'мука'],
  ['спагетти', 'яйца', 'сыр', 'бекон'],
  ['хлеб', 'сыр', 'яйца', 'масло'],
  ['капуста', 'морковь', 'лук', 'картофель'],
  ['творог', 'яйца', 'мука', 'сахар'],
  ['рис', 'яйца', 'лук', 'морковь'],
  ['куриная грудка', 'помидоры', 'сыр'],
  ['фарш', 'макароны', 'томатная паста', 'лук'],
  ['кабачки', 'яйца', 'мука', 'чеснок'],
  ['яйца'],
  ['картошка'],
  ['яйца', 'помидоры', 'лук', 'сыр', 'хлеб', 'масло', 'молоко', 'картошка'],
];

const TOP_EXPECTATIONS = [
  [['яблоки', 'мука', 'яйца', 'сахар'], 'Оладьи с яблоком'],
  [['творог', 'яйца', 'мука', 'сахар'], 'Сырники'],
  [['яйца', 'картошка', 'лук'], 'Драники'],
  [['капуста', 'морковь', 'лук', 'картофель'], 'Овощной суп с капустой'],
];

async function testMatching() {
  let nonEmpty = 0;
  for (const set of REGRESSION_SETS) {
    const r = await generate(set);
    if ((r.json?.recipes || []).length) nonEmpty++;
  }
  record('P0', 'подбор', 'все контрольные наборы дают результат', nonEmpty === REGRESSION_SETS.length,
    `${nonEmpty} из ${REGRESSION_SETS.length}`);

  for (const [set, expected] of TOP_EXPECTATIONS) {
    const r = await generate(set);
    const top = (r.json?.recipes || [])[0]?.title;
    record('P1', 'ранжирование', `«${set.join(', ')}» → ${expected}`, top === expected, `получено «${top}»`);
  }

  const r = await generate(['яйца', 'картошка', 'лук']);
  const rs = r.json?.recipes || [];
  record('P0', 'подбор', 'uses заполнен у всех карточек', rs.every(x => (x.uses || []).length > 0));
  record('P1', 'подбор', 'ответ не раздут', r.text.length < 60_000, `${Math.round(r.text.length / 1024)} КБ`);
  record('P1', 'подбор', 'страница ограничена', rs.length <= 24, `${rs.length} карточек`);

  const p2 = await generate(['яйца', 'картошка', 'лук'], { offset: 20 });
  const a = new Set(rs.map(x => x.id));
  const overlap = (p2.json?.recipes || []).filter(x => a.has(x.id)).length;
  record('P1', 'подбор', 'вторая страница без пересечений', overlap === 0, `пересечений ${overlap}`);

  const junk = await generate(['асдфгх', '12345']);
  record('P1', 'подбор', 'мусорный ввод не выдаёт рецептов', (junk.json?.recipes || []).length === 0);
  record('P1', 'подбор', 'мусорный ввод даёт подсказки', (junk.json?.suggestions || []).length > 0);

  const empty = await post('/api/generate', { ingredients: [] });
  record('P1', 'подбор', 'пустой ввод → 400', empty.status === 400);

  const six = await generate(['яйца', 'картошка', 'лук'], { portions: 6 });
  record('P1', 'подбор', 'порции доходят до карточки', (six.json?.recipes || [])[0]?.portions === 6);

  const quick = await generate(['яйца', 'картошка', 'лук'], { maxMinutes: 15 });
  const over = (quick.json?.recipes || []).filter(x => Number(x.minutes) > 15);
  record('P1', 'подбор', 'ограничение по времени соблюдается', over.length === 0, `нарушений ${over.length}`);

  const eqOff = await generate(['яйца', 'картошка', 'лук']);
  const eqOn = await generate(['яйца', 'картошка', 'лук'], { enforceEquipment: true, equipment: [] });
  record('P2', 'подбор', 'enforceEquipment влияет на выдачу',
    (eqOn.json?.recipes || []).length < (eqOff.json?.recipes || []).length,
    `${(eqOff.json?.recipes || []).length} → ${(eqOn.json?.recipes || []).length}`);

  const runs = new Set();
  for (let i = 0; i < 5; i++) {
    const x = await generate(['яйца', 'картошка', 'лук']);
    runs.add((x.json?.recipes || []).map(y => y.id).join('|'));
  }
  record('P0', 'подбор', 'выдача стабильна между запросами', runs.size === 1, `вариантов ${runs.size}`);
}

async function testInputRobustness() {
  const cases = [
    ['строка вместо массива', { ingredients: 'яйца' }],
    ['числа в списке', { ingredients: [1, 2, 3] }],
    ['объекты в списке', { ingredients: [{ a: 1 }] }],
    ['200 продуктов', { ingredients: Array.from({ length: 200 }, (_, i) => 'продукт' + i) }],
    ['строка на 5000 символов', { ingredients: ['я'.repeat(5000)] }],
    ['HTML-инъекция', { ingredients: ['<script>alert(1)</script>'] }],
    ['SQL-инъекция', { ingredients: ["'; DROP TABLE users;--"] }],
    ['эмодзи', { ingredients: ['🥚🥔'] }],
    ['portions вне диапазона', { ingredients: ['яйца'], portions: 9999 }],
    ['offset отрицательный', { ingredients: ['яйца'], offset: -10 }],
    ['course мусор', { ingredients: ['яйца'], course: '<b>x</b>' }],
  ];
  for (const [name, body] of cases) {
    let r;
    try { r = await post('/api/generate', body); }
    catch (e) { record('P0', 'устойчивость', name, false, 'исключение: ' + e.message); continue; }
    record('P0', 'устойчивость', name, r.status < 500, `статус ${r.status}`);
  }
  const xss = await generate(['<script>alert(1)</script>']);
  record('P0', 'безопасность', 'скрипт не возвращается сырым', !/<script>alert/.test(xss.text));
}

async function testNormalization() {
  const pairs = [
    ['картошка', 'картофель'],
    ['яйцо', 'яйца'],
    ['свекла', 'свёкла'],
    ['ЯЙЦА', 'яйца'],
    ['  яйца  ', 'яйца'],
  ];
  for (const [a, b] of pairs) {
    const ra = (await generate([a])).json?.recipes || [];
    const rb = (await generate([b])).json?.recipes || [];
    record('P1', 'нормализация', `«${a.trim()}» ≈ «${b}»`, Math.abs(ra.length - rb.length) <= 2,
      `${ra.length} против ${rb.length}`);
  }
}

async function testSeo(idx) {
  const routes = [
    ['/recipes', 200], ['/recipes/', 301], ['/recipe', 301], ['/recipe/', 301],
    ['/recipe/nonexistent-xyz', 404], ['/sitemap.xml', 200], ['/robots.txt', 200],
    ['/lite', 200], ['/nonexistent-page-xyz', 404],
  ];
  for (const [p, expected] of routes) {
    const r = await get(p);
    record('P1', 'SEO', `${p} → ${expected}`, r.status === expected, `получено ${r.status}`);
  }

  const sm = await get('/sitemap.xml');
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]);
  record('P0', 'SEO', 'sitemap — валидный XML', sm.text.trimStart().startsWith('<?xml'));
  record('P1', 'SEO', 'sitemap покрывает весь каталог', locs.length >= idx.length, `${locs.length} URL`);

  const robots = await get('/robots.txt');
  record('P1', 'SEO', 'robots ссылается на sitemap', /Sitemap:\s*https:\/\//i.test(robots.text));

  const sample = [...idx].sort(() => 0.5 - Math.random()).slice(0, 8);
  for (const e of sample) {
    const slug = (e.photo?.page || '').match(/\/img\/([a-z0-9-]+)-4x3/)?.[1];
    const loc = locs.find(u => slug ? u.endsWith('/' + slug) : false);
    const path = loc ? new URL(loc).pathname : null;
    if (!path) continue;
    const r = await get(path);
    const okStatus = r.status === 200;
    const hasLd = /application\/ld\+json/.test(r.text);
    const hasH1 = /<h1[^>]*>[^<]+<\/h1>/.test(r.text);
    const hasImg = /<img/.test(r.text);
    const ldImage = /"image":\s*\[/.test(r.text);
    record('P1', 'SEO', `${path}: 200 + JSON-LD + H1`, okStatus && hasLd && hasH1,
      `${r.status}, ld=${hasLd}, h1=${hasH1}`);
    if (e.hasPhoto) {
      record('P1', 'SEO', `${path}: картинка в разметке и на странице`, ldImage && hasImg,
        `ld image=${ldImage}, <img>=${hasImg}`);
    }
  }
}

async function testRecipeDetail(idx) {
  const sample = [...idx].sort(() => 0.5 - Math.random()).slice(0, 10);
  let ok = 0, noSteps = 0;
  for (const e of sample) {
    const r = await get('/api/recipe/' + encodeURIComponent(e.id));
    if (r.status === 200) {
      ok++;
      if (!((r.json?.recipe?.steps) || []).length) noSteps++;
    }
  }
  record('P0', 'деталь', 'случайные рецепты открываются', ok === sample.length, `${ok} из ${sample.length}`);
  record('P0', 'деталь', 'у рецептов есть шаги', noSteps === 0, `без шагов ${noSteps}`);

  const id = encodeURIComponent(idx[0].id);
  const p1 = (await get(`/api/recipe/${id}?portions=2`)).json?.recipe;
  const p8 = (await get(`/api/recipe/${id}?portions=8`)).json?.recipe;
  record('P1', 'деталь', 'порции масштабируют количества',
    JSON.stringify(p1?.ingredients) !== JSON.stringify(p8?.ingredients));
  record('P1', 'деталь', 'нет дробных штук',
    !/(0,\d+|\d+,\d+)\s*шт/.test(JSON.stringify(p8?.ingredients || [])));

  for (const bad of ['nope', '../../etc/passwd', 'a'.repeat(500)]) {
    const r = await get('/api/recipe/' + encodeURIComponent(bad));
    record('P1', 'деталь', `битый id «${bad.slice(0, 20)}» → 404`, r.status === 404, `${r.status}`);
  }
}

async function testLite() {
  for (const p of ['/lite', '/lite?products=яйца,картошка,лук', '/lite?q=борщ', '/lite?page=999']) {
    const r = await get(p);
    record('P2', 'lite', `${p} → 200`, r.status === 200, `${r.status}`);
  }
  const lite = await get('/lite');
  record('P2', 'lite', 'лёгкая версия остаётся лёгкой', lite.text.length < 40_000,
    `${Math.round(lite.text.length / 1024)} КБ`);
}

(async () => {
  console.log(`\nПрогон против ${BASE}\n${'─'.repeat(60)}`);
  await testHealth();
  await testCacheHeaders();
  await testCatalog();
  const idx = await testIndex();
  await testPhotos(idx);
  await testMatching();
  await testInputRobustness();
  await testNormalization();
  await testSeo(idx);
  await testRecipeDetail(idx);
  await testLite();

  const failed = results.filter(r => !r.ok);
  const bySeverity = sev => failed.filter(r => r.sev === sev).length;
  console.log('─'.repeat(60));
  console.log(`проверок: ${checks} · упало: ${failed.length} (P0: ${bySeverity('P0')}, P1: ${bySeverity('P1')}, P2: ${bySeverity('P2')})`);
  if (failed.length) {
    console.log('\nПадения:');
    failed.forEach(f => console.log(`  [${f.sev}] ${f.area} · ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
  }
  process.exit(bySeverity('P0') + bySeverity('P1') > 0 ? 1 : 0);
})();
