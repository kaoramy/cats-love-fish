// Слой данных над db.js: кэш категорий, настроек и словаря в памяти, операции, итоги.
// Экраны работают только через этот модуль и подписываются на изменения через onChange.
import { db, requestPersistence } from './db.js';
import { defaultCategories } from './categories.js';
import { uid, round2 } from './util.js';
import { indexUserDict, dictKey } from './classifier.js';

const DEFAULT_SETTINGS = {
  currency: 'RUB',            // валюта отображения
  currencies: ['RUB', 'EUR'], // валюты, между которыми можно переключаться
};

export const state = {
  cats: [],
  catMap: new Map(),
  settings: structuredClone(DEFAULT_SETTINGS),
  userDict: new Map(),
};

// ---------- подписка на изменения ----------
const listeners = new Set();
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(what) {
  for (const fn of listeners) {
    try { fn(what); } catch (e) { console.error(e); }
  }
}

// Подписка на локальные записи (для отправки в семью). Отдельно от onChange: не перерисовывает экран.
const writeListeners = new Set();
export function onWrite(fn) {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}
function touched(kind) {
  for (const fn of writeListeners) {
    try { fn(kind); } catch (e) { console.error(e); }
  }
}

// ---------- запуск ----------
export async function initStore() {
  // Категории: досеваем встроенные, которых ещё нет. Изменения пользователя не трогаем.
  // Встроенную категорию не удаляют, а скрывают (hidden: true), иначе она вернётся здесь.
  let cats = await db.all('cats');
  const have = new Set(cats.map(c => c.id));
  const missing = defaultCategories().filter(c => !have.has(c.id));
  if (missing.length) {
    await db.bulkPut('cats', missing);
    cats = cats.concat(missing);
  }
  for (const { key, value } of await db.all('settings')) state.settings[key] = value;

  // Дизайн v2 (12.11.2026): новая палитра и значки у встроенных категорий. Выполняется один раз.
  if (!(state.settings.designV >= 2)) {
    const defs = new Map(defaultCategories().map(c => [c.id, c]));
    const changed = [];
    cats = cats.map(c => {
      const d = c.builtin && defs.get(c.id);
      if (!d) return c;
      const n = { ...c, color: d.color, icon: d.icon, updatedAt: Date.now() };
      changed.push(n);
      return n;
    });
    await db.bulkPut('cats', changed);
    await db.put('settings', { key: 'designV', value: 2 });
    state.settings.designV = 2;
  }
  // Дизайн v3: у встроенных категорий обновляем только значок (энергетики стали банкой с молнией).
  if (state.settings.designV < 3) {
    const defs3 = new Map(defaultCategories().map(c => [c.id, c]));
    const ch = [];
    cats = cats.map(c => {
      const d = c.builtin && defs3.get(c.id);
      if (!d || c.icon === d.icon) return c;
      const n = { ...c, icon: d.icon, updatedAt: Date.now() };
      ch.push(n);
      return n;
    });
    if (ch.length) await db.bulkPut('cats', ch);
    await db.put('settings', { key: 'designV', value: 3 });
    state.settings.designV = 3;
  }
  setCats(cats);

  state.userDict = new Map((await db.all('dict')).map(e => [e.key, e]));
  indexUserDict(state.userDict);

  requestPersistence();
}

function setCats(cats) {
  cats.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  state.cats = cats;
  state.catMap = new Map(cats.map(c => [c.id, c]));
}

// ---------- категории ----------
const FALLBACK = { id: 'other', name: 'Другое', icon: '📦', color: '#BBA58F', parent: null, type: 'expense' };

export function cat(id) {
  return state.catMap.get(id) || state.catMap.get('other') || FALLBACK;
}

export function topCat(id) {
  let c = cat(id);
  while (c.parent) {
    const p = state.catMap.get(c.parent);
    if (!p) break;
    c = p;
  }
  return c;
}

export const topCats = type => state.cats.filter(c => !c.parent && c.type === type && !c.hidden);
export const subCats = parentId => state.cats.filter(c => c.parent === parentId && !c.hidden);

// Создать или изменить категорию (имя, значок, цвет, скрытие). Встроенные не удаляем, а скрываем.
export async function saveCat(c) {
  const isNew = !c.id;
  const rec = {
    ...c,
    id: c.id || 'c.' + uid(),
    order: c.order ?? (Math.max(-1, ...state.cats.map(x => x.order ?? 0)) + 1),
    updatedAt: Date.now(),
  };
  await db.put('cats', rec);
  setCats(isNew || !state.catMap.has(rec.id) ? [...state.cats, rec] : state.cats.map(x => x.id === rec.id ? rec : x));
  touched('cat');
  emit('cats');
  return rec;
}

// ---------- резервная копия ----------
export async function exportAll() {
  const [ops, cats, dict, settings] = await Promise.all([db.all('ops'), db.all('cats'), db.all('dict'), db.all('settings')]);
  return { app: 'morkovka', version: 1, exportedAt: new Date().toISOString(), ops, cats, dict, settings };
}

export function checkBackup(data) {
  if (!data || data.app !== 'morkovka' || !Array.isArray(data.ops) || !Array.isArray(data.cats)) {
    throw new Error('Это не файл резервной копии Морковки');
  }
  return {
    ops: data.ops.filter(o => !o.deleted).length,
    cats: data.cats.length,
    dict: (data.dict || []).length,
    date: data.exportedAt || '',
  };
}

// mode: 'merge' — новее по updatedAt побеждает, ничего не стирается; 'replace' — копия заменяет всё.
export async function importAll(data, mode) {
  checkBackup(data);
  const stores = [['ops', 'id', data.ops], ['cats', 'id', data.cats], ['dict', 'key', data.dict || []]];
  if (mode === 'replace') {
    for (const [name, , list] of stores) { await db.clear(name); await db.bulkPut(name, list); }
    await db.clear('settings');
    await db.bulkPut('settings', data.settings || []);
  } else {
    for (const [name, k, list] of stores) {
      const have = new Map((await db.all(name)).map(x => [x[k], x]));
      const take = list.filter(x => {
        const old = have.get(x[k]);
        return !old || (x.updatedAt || 0) > (old.updatedAt || 0);
      });
      await db.bulkPut(name, take);
    }
    const cur = (await db.all('settings')).find(s => s.key === 'currencies')?.value || state.settings.currencies;
    const inc = (data.settings || []).find(s => s.key === 'currencies')?.value || [];
    await db.put('settings', { key: 'currencies', value: [...new Set([...cur, ...inc])] });
  }
}

// ---------- настройки ----------
export async function setSetting(key, value) {
  state.settings[key] = value;
  await db.put('settings', { key, value });
  emit('settings');
}

// ---------- личный словарь ----------
// Запоминаем, в какую категорию пользователь отнёс товар. Экран не перерисовываем.
export async function learnDict(name, catId) {
  const key = dictKey(name);
  if (!key) return;
  const old = state.userDict.get(key);
  const e = { key, cat: catId, name: String(name).slice(0, 90), n: (old?.n || 0) + 1, user: true, updatedAt: Date.now() };
  await db.put('dict', e);
  state.userDict.set(key, e);
  indexUserDict(state.userDict);
  touched('dict');
}

// ---------- операции ----------
const byNewest = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);

// Операции за период [from, to] (даты 'YYYY-MM-DD' включительно) в одной валюте, новые сверху.
export async function opsInRange(from, to, currency = state.settings.currency) {
  const list = await db.range('ops', 'date', from, to);
  return list.filter(o => !o.deleted && (!currency || o.currency === currency)).sort(byNewest);
}

export const allOps = (currency = state.settings.currency) => opsInRange('0000-01-01', '9999-12-31', currency);

export const getOp = async id => {
  const o = await db.get('ops', id);
  return o && !o.deleted ? o : undefined;
};

export async function saveOp(op) {
  const now = Date.now();
  const o = {
    ...op,
    id: op.id || uid(),
    amount: round2(op.amount),
    currency: op.currency || state.settings.currency,
    createdAt: op.createdAt || now,
    updatedAt: now,
  };
  await db.put('ops', o);
  if (!state.settings.currencies.includes(o.currency)) {
    await setSetting('currencies', [...state.settings.currencies, o.currency]);
  }
  touched('op');
  emit('ops');
  return o;
}

// Удаление — это пометка, а не стирание: при синхронизации с семьёй второй телефон
// должен узнать, что запись удалена. Из списков и итогов такие записи исключены.
export async function deleteOp(id) {
  const o = await db.get('ops', id);
  if (!o || o.deleted) return;
  await db.put('ops', { id: o.id, date: o.date, type: o.type, amount: 0, currency: o.currency, cat: o.cat,
    createdAt: o.createdAt, deleted: true, updatedAt: Date.now() });
  touched('op');
  emit('ops');
}

// ---------- обмен с семьёй (используется sync.js) ----------
// Всё, что изменено после момента since (мс): отправляем в семью.
export async function localSince(since) {
  const [ops, cats, dict] = await Promise.all([db.all('ops'), db.all('cats'), db.all('dict')]);
  const pick = list => list.filter(x => (x.updatedAt || 0) > since);
  return { ops: pick(ops), cats: pick(cats), dict: pick(dict) };
}

// Принять запись от другого устройства: побеждает та, у которой updatedAt больше. Возвращает true, если записали.
export async function applyRemote(kind, rec) {
  const name = kind === 'op' ? 'ops' : kind === 'cat' ? 'cats' : 'dict';
  const key = name === 'dict' ? 'key' : 'id';
  if (!rec || rec[key] == null) return false;
  const old = await db.get(name, rec[key]);
  if (old && (old.updatedAt || 0) >= (rec.updatedAt || 0)) return false;
  await db.put(name, rec);
  if (kind === 'cat') setCats(state.catMap.has(rec.id) ? state.cats.map(c => c.id === rec.id ? rec : c) : [...state.cats, rec]);
  if (kind === 'dict') { state.userDict.set(rec.key, rec); indexUserDict(state.userDict); }
  if (kind === 'op' && rec.currency && !state.settings.currencies.includes(rec.currency)) {
    state.settings.currencies = [...state.settings.currencies, rec.currency];
    await db.put('settings', { key: 'currencies', value: state.settings.currencies });
  }
  return true;
}

// Сказать экранам, что пришли чужие изменения (add и settings при этом не перерисовываются, см. app.js).
export const remoteApplied = () => emit('remote');

// Настройки синхронизации без перерисовки экрана.
export async function setQuiet(key, value) {
  if (value === undefined) { delete state.settings[key]; await db.del('settings', key); return; }
  state.settings[key] = value;
  await db.put('settings', { key, value });
}

// ---------- итоги ----------
// Разложить операцию по категориям: позиции чека идут в свои категории,
// разница между суммой операции и суммой позиций — в категорию самой операции.
export function opParts(op) {
  if (!op.items || !op.items.length) return [[op.cat, op.amount]];
  const parts = new Map();
  let sum = 0;
  for (const it of op.items) {
    parts.set(it.cat, (parts.get(it.cat) || 0) + it.total);
    sum += it.total;
  }
  const rest = round2(op.amount - sum);
  if (Math.abs(rest) >= 0.01) parts.set(op.cat, (parts.get(op.cat) || 0) + rest);
  return [...parts];
}

// { expense, income, count, expenseTop: [{cat, sum, share}], incomeTop: [...], expenseLeaf: Map(catId -> sum) }
export function summarize(ops) {
  let expense = 0, income = 0;
  const expTop = new Map(), incTop = new Map(), leaf = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const o of ops) {
    if (o.type === 'income') {
      income += o.amount;
      add(incTop, topCat(o.cat).id, o.amount);
      continue;
    }
    expense += o.amount;
    for (const [c, v] of opParts(o)) {
      add(expTop, topCat(c).id, v);
      add(leaf, c, v);
    }
  }
  const toList = (m, total) => [...m]
    .map(([c, sum]) => ({ cat: c, sum: round2(sum), share: total > 0 ? sum / total : 0 }))
    .filter(x => Math.abs(x.sum) >= 0.01)
    .sort((a, b) => b.sum - a.sum);
  return {
    expense: round2(expense),
    income: round2(income),
    count: ops.length,
    expenseTop: toList(expTop, expense),
    incomeTop: toList(incTop, income),
    expenseLeaf: leaf,
  };
}
