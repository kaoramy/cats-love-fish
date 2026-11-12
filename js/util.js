// Общие помощники: форматирование, даты, числа, экранирование.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const round2 = x => Math.round((Number(x) + Number.EPSILON) * 100) / 100;

export const CURRENCIES = {
  RUB: { symbol: '₽', name: 'Российский рубль' },
  EUR: { symbol: '€', name: 'Евро' },
  USD: { symbol: '$', name: 'Доллар США' },
  GBP: { symbol: '£', name: 'Фунт стерлингов' },
  KZT: { symbol: '₸', name: 'Тенге' },
  BYN: { symbol: 'Br', name: 'Белорусский рубль' },
  UAH: { symbol: '₴', name: 'Гривна' },
  GEL: { symbol: '₾', name: 'Лари' },
  AMD: { symbol: '֏', name: 'Драм' },
  TRY: { symbol: '₺', name: 'Турецкая лира' },
  CNY: { symbol: '¥', name: 'Юань' },
  PLN: { symbol: 'zł', name: 'Злотый' },
  SEK: { symbol: 'kr', name: 'Шведская крона' },
  CHF: { symbol: 'Fr', name: 'Швейцарский франк' },
};

export const curSymbol = c => (CURRENCIES[c] && CURRENCIES[c].symbol) || c;

const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

// 1234.5 -> "1 234,50 ₽"; целые суммы без копеек
export function money(v, cur = 'RUB', opts = {}) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const whole = Math.abs(abs - Math.round(abs)) < 0.005;
  let s = (whole && !opts.forceDecimals ? nf0 : nf2).format(abs);
  let sign = '';
  if (n < 0) sign = '−';
  else if (opts.sign && n > 0) sign = '+';
  return `${sign}${s} ${curSymbol(cur)}`;
}

export function moneyShort(v, cur = 'RUB') {
  const n = Math.abs(Number(v) || 0);
  let s;
  if (n >= 1e6) s = (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' млн';
  else if (n >= 1e4) s = Math.round(n / 1e3) + ' тыс';
  else s = nf0.format(n);
  return `${(Number(v) || 0) < 0 ? '−' : ''}${s} ${curSymbol(cur)}`;
}

export function numStr(v, maxDec = 3) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: maxDec, useGrouping: false }).format(n);
}

// Разбор числа из пользовательского ввода: "1 234,56" -> 1234.56
export function parseNum(str) {
  if (typeof str === 'number') return str;
  if (str == null) return NaN;
  let s = String(str).trim().replace(/[\s ]/g, '').replace(/[−–—]/g, '-').replace(',', '.');
  if (!s) return NaN;
  return Number(s);
}

// ---------- Даты ----------
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const pad = n => String(n).padStart(2, '0');

export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => isoDate(new Date());
export const monthKey = iso => iso.slice(0, 7);

export function addMonths(mk, delta) {
  let [y, m] = mk.split('-').map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${pad(m)}`;
}

export function monthLabel(mk, short = false) {
  const [y, m] = mk.split('-').map(Number);
  return short ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
}

export function lastDayOfMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  return `${mk}-${pad(new Date(y, m, 0).getDate())}`;
}

export function fmtDate(iso, withYear) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  const showYear = withYear ?? y !== now.getFullYear();
  return `${d} ${MONTHS_GEN[m - 1]}${showYear ? ' ' + y : ''}`;
}

export function dayLabel(iso) {
  const t = todayISO();
  const y = isoDate(new Date(Date.now() - 864e5));
  if (iso === t) return 'Сегодня';
  if (iso === y) return 'Вчера';
  const wd = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][new Date(iso + 'T12:00').getDay()];
  return `${fmtDate(iso)}, ${wd}`;
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
}

// Период: {mode:'month'|'year'|'all'|'custom', month:'2026-11', year:2026, from, to}
export function periodRange(p) {
  if (p.mode === 'month') return { from: `${p.month}-01`, to: lastDayOfMonth(p.month), label: monthLabel(p.month) };
  if (p.mode === 'year') return { from: `${p.year}-01-01`, to: `${p.year}-12-31`, label: `${p.year} год` };
  if (p.mode === 'custom') return { from: p.from, to: p.to, label: `${fmtDate(p.from, true)} — ${fmtDate(p.to, true)}` };
  return { from: '0000-01-01', to: '9999-12-31', label: 'Всё время' };
}

export function shiftPeriod(p, delta) {
  if (p.mode === 'month') return { ...p, month: addMonths(p.month, delta) };
  if (p.mode === 'year') return { ...p, year: p.year + delta };
  return p;
}

// ---------- Текст ----------
export function norm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
