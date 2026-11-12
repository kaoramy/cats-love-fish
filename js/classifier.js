// Автоматическая классификация товаров: личный словарь пользователя → встроенный словарь → «Другое».
import { BUILTIN_DICT } from './dictionary.js';

const LAT2CYR = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', k: 'к', m: 'м', t: 'т', h: 'н', y: 'у', b: 'в' };
const CYR2LAT = { 'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'к': 'k', 'м': 'm', 'т': 't', 'н': 'h', 'у': 'y', 'в': 'b' };
const UNITS = new Set(['мл', 'л', 'г', 'гр', 'кг', 'шт', 'уп', 'упак', 'ml', 'l', 'g', 'gr', 'kg', 'tk', 'pcs', 'см', 'мм', 'cm', 'mm', 'x', 'х', 'вес', 'весов', 'весовой', 'весовые', 'фас', 'пэт', 'ст', 'тб', 'ж', 'б', 'жб']);

// Внутри одного слова OCR часто путает похожие латинские и кириллические буквы.
export function fixMixed(token) {
  const cyr = (token.match(/[а-яё]/gi) || []).length;
  const lat = (token.match(/[a-z]/gi) || []).length;
  if (!cyr || !lat) return token;
  if (cyr >= lat) return token.replace(/[a-z]/gi, ch => {
    const m = LAT2CYR[ch.toLowerCase()];
    return m ? (ch === ch.toUpperCase() ? m.toUpperCase() : m) : ch;
  });
  return token.replace(/[а-яё]/gi, ch => {
    const m = CYR2LAT[ch.toLowerCase()];
    return m ? (ch === ch.toUpperCase() ? m.toUpperCase() : m) : ch;
  });
}

export function tokenize(name) {
  const s = String(name || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\d]+/gu, ' ');
  return s.split(' ')
    .filter(Boolean)
    .map(fixMixed)
    .filter(t => !/\d/.test(t) && t.length >= 2 && !UNITS.has(t));
}

export function dictKey(name) {
  return tokenize(name).slice(0, 4).join(' ');
}

// ---------- компиляция встроенного словаря ----------
const RULES = [];
(function compile() {
  for (const [cat, str] of Object.entries(BUILTIN_DICT)) {
    for (let raw of str.split('|')) {
      raw = raw.trim().toLowerCase().replace(/ё/g, 'е');
      if (!raw) continue;
      let prio = false;
      if (raw.startsWith('!')) { prio = true; raw = raw.slice(1); }
      let kind = 'stem';
      if (raw.startsWith('=')) { kind = 'exact'; raw = raw.slice(1); }
      else if (raw.startsWith('~')) { kind = 'sub'; raw = raw.slice(1); }
      raw = raw.replace(/[^\p{L}\d ]+/gu, ' ').replace(/\s+/g, ' ').trim();
      if (!raw) continue;
      if (raw.includes(' ')) RULES.push({ cat, kind: kind === 'exact' ? 'phraseExact' : 'phrase', words: raw.split(' '), len: raw.length, prio });
      else RULES.push({ cat, kind, word: raw, len: raw.length, prio });
    }
  }
})();

function lev1Prefix(token, stem) {
  // допускаем одну ошибку OCR в начале слова длиной ≥5
  if (stem.length < 5 || token.length < stem.length - 1) return false;
  const t = token.slice(0, stem.length);
  return levenshtein(t, stem, 1) <= 1;
}

export function levenshtein(a, b, max = 99) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function posBonus(i) { return i === 0 ? 12 : Math.max(0, 4 - i); }

export function classifyBuiltin(tokens) {
  const best = new Map();
  const put = (cat, score) => { if (!best.has(cat) || best.get(cat) < score) best.set(cat, score); };
  for (const r of RULES) {
    const base = 10 + Math.min(r.len, 12) + (r.prio ? 30 : 0);
    if (r.kind === 'phrase' || r.kind === 'phraseExact') {
      for (let i = 0; i + r.words.length <= tokens.length; i++) {
        let ok = true;
        for (let k = 0; k < r.words.length; k++) {
          const t = tokens[i + k], w = r.words[k];
          if (!(r.kind === 'phraseExact' && k === r.words.length - 1 ? t === w : t.startsWith(w))) { ok = false; break; }
        }
        if (ok) { put(r.cat, base + 4 + posBonus(i)); break; }
      }
      continue;
    }
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      let s = -1;
      if (r.kind === 'exact') { if (t === r.word) s = base + 2; }
      else if (r.kind === 'stem') {
        if (t.startsWith(r.word)) s = base;
        else if (lev1Prefix(t, r.word)) s = base - 5;
      } else if (r.kind === 'sub') {
        const idx = t.indexOf(r.word);
        if (idx >= 0) s = base + (idx + r.word.length >= t.length - 2 ? 8 : 0) + (idx === 0 ? 2 : 0);
      }
      if (s >= 0) put(r.cat, s + posBonus(i));
    }
  }
  let cat = null, score = 0;
  for (const [c, s] of best) if (s > score) { cat = c; score = s; }
  return cat ? { cat, score } : null;
}

// ---------- личный словарь ----------
// userDict: Map key -> {key, cat, name, n, user}
let bucket = new Map(); // первые 3 буквы ключа -> [entries]
let byPrefix2 = new Map(); // первые два слова -> Map(cat -> count)

export function indexUserDict(userDict) {
  bucket = new Map();
  byPrefix2 = new Map();
  for (const e of userDict.values()) {
    const b = e.key.slice(0, 3);
    if (!bucket.has(b)) bucket.set(b, []);
    bucket.get(b).push(e);
    const p2 = e.key.split(' ').slice(0, 2).join(' ');
    if (!p2) continue;
    if (!byPrefix2.has(p2)) byPrefix2.set(p2, new Map());
    const m = byPrefix2.get(p2);
    m.set(e.cat, (m.get(e.cat) || 0) + (e.user ? 3 : 1));
  }
}

export function classify(name, userDict, { storeHint, validCats } = {}) {
  const tokens = tokenize(name);
  const key = tokens.slice(0, 4).join(' ');
  const valid = c => !validCats || validCats.has(c);
  if (key && userDict && userDict.has(key) && valid(userDict.get(key).cat)) {
    return { cat: userDict.get(key).cat, source: 'user', sure: true };
  }
  // похожее название (ошибка OCR в одну-две буквы)
  if (key.length >= 6) {
    const cands = bucket.get(key.slice(0, 3)) || [];
    let bestE = null, bestD = 99;
    const maxD = key.length >= 12 ? 2 : 1;
    for (const e of cands) {
      const d = levenshtein(key, e.key, maxD);
      if (d < bestD) { bestD = d; bestE = e; }
    }
    if (bestE && bestD <= maxD && valid(bestE.cat)) return { cat: bestE.cat, source: 'user', sure: true };
  }
  const p2 = tokens.slice(0, 2).join(' ');
  if (tokens.length >= 2 && byPrefix2.has(p2)) {
    let cat = null, n = 0;
    for (const [c, k] of byPrefix2.get(p2)) if (k > n && valid(c)) { cat = c; n = k; }
    if (cat) return { cat, source: 'similar', sure: true };
  }
  const b = classifyBuiltin(tokens);
  if (b && valid(b.cat)) return { cat: b.cat, source: 'dict', sure: b.score >= 22 };
  if (storeHint && valid(storeHint)) return { cat: storeHint, source: 'store', sure: false };
  return { cat: 'food.other', source: 'none', sure: false };
}
