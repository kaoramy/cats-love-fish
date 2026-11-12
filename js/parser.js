// Разбор текста кассового чека (русские и эстонские чеки, EUR/RUB, запятая и точка).
// На входе — строки [{text, conf}] от OCR или просто текст (Live Text).
import { STORES } from './dictionary.js';
import { fixMixed } from './classifier.js';

const L = '\\p{L}';
const re = (s, f = 'iu') => new RegExp(s, f);
const nb = w => `(?<!${L})(?:${w})(?!${L})`; // «целое слово» для кириллицы

const TOTAL_RE = re(`^[^\\p{L}\\d]{0,3}(?:${[
  'итог[оа]?', '[иi1l][тt][оo0][гr]', 'всего(?:\\s*к\\s*оплате)?', '(?:сумма\\s*)?к\\s*оплате', 'сумма\\s*по\\s*чеку',
  'kokku(?:\\s*tasuda)?', 'summa\\s*kokku', 'summa', 'tasuda', 'maksta', 'maksmisele', 'total', 'yhteensä', 'kokku\\s*eur',
].join('|')})(?!\\p{L})`);
const TOTAL_EXCL = re(`(скидк|ндс|nds|soodus|allahindl|${nb('km')}|käibemaks|${nb('vat')}|бонус|балл|сдача|наличн|безнал|карт|säästs|tagasi|подыт|промежут|без\\s*скид|kaart|sularaha|ilma)`);
const HEADER_END = re(`(кассовый\\s*чек|${nb('приход')}|${nb('продажа')}|чек\\s*№|товарный\\s*чек|kviitung|${nb('tšekk')}|${nb('tsekk')}|${nb('müük')}|${nb('arve')})`);
const SKIP_RE = re([
  nb('инн'), nb('ккт'), 'фн\\s*№', nb('фн'), nb('фд'), nb('фп'), nb('фпд'), 'рн\\s*ккт', 'зн\\s*ккт', nb('сно'), nb('осн'), nb('усн'), nb('енвд'),
  'кассир', 'смена', 'чек\\s*№', 'кассовый', 'сайт\\s*фнс', 'nalog', 'www\\.', 'https?:', nb('тел'), 'телефон', 'адрес', 'место\\s*расч',
  'спасибо', 'добро\\s*пожал', nb('ндс'), 'безналичн', 'наличн', 'электрон', 'получено', 'сдача', 'бонус', 'баллы', 'лояльн',
  'признак', 'полный\\s*расч', 'предмет\\s*расч', `^\\s*${nb('товар')}\\s*$`, nb('офд'), nb('ofd'), 'оператор', 'reg\\.?\\s*nr', 'registrikood', nb('kmkr'),
  'käibemaks', nb('km'), 'aadress', 'kassapidaja', 'kassiir', 'kassa\\s*\\d', 'kviitung', 'arve\\s*nr', nb('kaart'), 'kaardimakse', 'pangakaart',
  'sularaha', 'tagasi', 'aitäh', 'tere\\s*tulemast', 'klient', 'kliendikaart', 'säästetud', 'säästsid', 'boonus', 'tehing', 'terminal', 'autoris',
  nb('visa'), 'mastercard', 'maestro', nb('rrn'), nb('appr'), 'авториз', 'одобрено', 'терминал', 'оплата\\s*карт', 'эквайр', nb('мир'),
  '^\\s*(?:наименование|цена|кол-?во|количество|toode|nimetus|kogus|hind)(?!\\p{L})', 'дата\\s*[:\\s]', 'время', 'kuupäev', nb('kell'), 'смена\\s*№', 'документ', 'код\\s*маркир', 'маркир', 'qr-?код', 'vat\\s*reg', 'kmkr', nb('vat'), nb('tax'), nb('nds'), nb('[нh][дa][сc]'), 'сумма\\s*[нh][дa][сc]', 'ЗН\\s*ККТ', 'место\\s*расч', 'пункт\\s*выдачи', 'печать\\s*доступна', 'подписке', 'онлайн\\s*-?\\s*касса',
].join('|'));
const DISC_RE = re(`(скидк|${nb('discount')}|allahindl|soodus|${nb('акция')}|выгода|промо|купон|soodushind|kampaania)`);
const DISC_SUMMARY_RE = re(`(всего\\s*скид|итого?\\s*скид|сумма\\s*скид|скидка\\s*по\\s*чеку|скидк[аи]\\s*на\\s*чек|kokku\\s*soodus|soodustus\\s*kokku|säästsid|вы\\s*сэконом|ваша\\s*выгода|kokku\\s*allahindl)`);
const MONEY_END = /(-?\d+\.\d{2})\s*(?:₽|руб\.?|р\.?|€|eur|[a-zа-я])?\s*$/iu;
const MONEY_ONLY = /^[\s=:*]*(-?\d+\.\d{2})\s*(?:₽|руб\.?|р\.?|€|eur|[a-zа-я])?\s*$/iu;
const QTY_RE = /(\d+(?:\.\d{1,3})?)\s*(?:шт|кг|kg|tk|pcs|г|l|л)?\.?\s*[xх×*ж]\s*(\d+(?:\.\d{1,3})?)(?:\s*(?:€|eur|руб\.?|р\.?|₽)?\s*\/\s*(?:кг|kg|шт|tk|l|л))?/iu;
const LETTERS = /\p{L}/gu;

const near = (a, b, tol) => Math.abs(a - b) <= (tol ?? Math.max(0.02, Math.abs(b) * 0.01));
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const decs = s => (String(s).split('.')[1] || '').length;
const letterCount = s => (s.match(LETTERS) || []).length;

// ---------- нормализация строки ----------
export function normalizeLine(raw) {
  let s = String(raw || '').replace(/[‒-―−]/g, '-').replace(/[\t ]/g, ' ');
  // буквы внутри чисел: 1O9,99 -> 109,99; З9.99 -> 39.99
  s = s.replace(/(?<![\p{L}])[\dOoОоЗзlI|]+[.,][\dOoОоЗз]{2,3}(?![\p{L}\d])/gu, tok => {
    if ((tok.match(/\d/g) || []).length < 2) return tok;
    return tok.replace(/[OoОо]/g, '0').replace(/[Зз]/g, '3').replace(/[lI|]/g, '1');
  });
  s = s.replace(/(\d)\s?,\s?(\d)/g, '$1.$2');            // десятичная запятая
  s = s.replace(/(\d)\s+\.\s*(\d{2})(?!\d)/g, '$1.$2');   // "89 .99"
  s = s.replace(/(\d)\.\s+(\d{2})(?!\d)/g, '$1.$2');      // "89. 99"
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function fixThousands(s) {
  // "=1 234.56" -> "=1234.56" — только в строках итога/оплаты
  return s.replace(/(\d{1,3})[ '](\d{3}\.\d{2})(?!\d)/g, '$1$2');
}

function lastMoney(s) {
  const m = s.match(MONEY_END);
  return m ? Number(m[1]) : null;
}
function anyMoney(s) {
  const all = s.match(/-?\d+\.\d{2}(?!\d)/g);
  return all ? Number(all[all.length - 1]) : null;
}

// ---------- имя товара ----------
export function cleanName(raw) {
  let s = String(raw || '')
    .replace(/^\s*(?:№\s*)?\d{1,3}\s*[.)]\s+/, '')       // "1. " "2) "
    .replace(/^\s*\*+\s*/, '')
    .replace(/[=*:,;]+\s*$/, '')
    .replace(/\s+[A-ZА-Я]$/u, '')                         // код НДС в конце
    .replace(/\s+/g, ' ').trim();
  s = s.split(' ').map(fixMixed).join(' ');
  const letters = s.match(/\p{L}/gu) || [];
  const upper = letters.filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  if (letters.length > 3 && upper / letters.length > 0.7) {
    s = s.toLowerCase();
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s.slice(0, 90);
}

// qty/price из двух чисел a ⨯ b
function assignQty(aS, bS, sep, total) {
  const a = Number(aS), b = Number(bS);
  let qty, price;
  if (decs(aS) === 3 && decs(bS) !== 3) { qty = a; price = b; }
  else if (decs(bS) === 3 && decs(aS) !== 3) { qty = b; price = a; }
  else if (Number.isInteger(a) && decs(aS) === 0 && decs(bS) === 2) { qty = a; price = b; }
  else if (Number.isInteger(b) && decs(bS) === 0 && decs(aS) === 2) { qty = b; price = a; }
  else if (sep === '*') { price = a; qty = b; }   // ККТ: цена * количество
  else { qty = a; price = b; }                     // EE: kogus x hind
  if (total != null && !near(qty * price, total)) {
    // может, наоборот?
    if (near(a * b, total)) { /* произведение верное — оставляем */ }
  }
  return { qty, price };
}

function matchQty(line) {
  const m = line.match(QTY_RE);
  if (!m) return null;
  const sep = (line.slice(m.index, m.index + m[0].length).match(/[xх×*ж]/iu) || ['x'])[0];
  const before = line.slice(0, m.index);
  const after = line.slice(m.index + m[0].length);
  let total = null;
  const tm = after.match(/^\s*=?\s*(-?\d+\.\d{2})(?!\d)/);
  if (tm) total = Number(tm[1]);
  else {
    const am = after.match(/(-?\d+\.\d{2})\s*(?:₽|руб\.?|р\.?|€|eur|[a-zа-я])?\s*$/iu);
    if (am) total = Number(am[1]);
  }
  const { qty, price } = assignQty(m[1], m[2], sep === '*' ? '*' : 'x', total);
  const product = r2(qty * price);
  const consistent = total == null ? true : near(product, total);
  // «Салфетки 20х20 59.99» — это часть названия, а не количество
  const nameLetters = letterCount(before);
  if (!consistent && nameLetters >= 3 && decs(m[1]) === 0 && decs(m[2]) === 0) return null;
  if (qty <= 0 || qty > 999 || price <= 0) return null;
  return { qty, price, total: total ?? product, consistent, namePart: before.trim(), hadTotal: total != null };
}

// «Молоко 1 89.99 89.99», «Молоко 89.99 1.000 89.99», «Вода 2 59.98»
function matchTrailingNums(line) {
  const toks = line.split(' ');
  const nums = [];
  while (toks.length) {
    const t = toks[toks.length - 1].replace(/^[=*]+/, '').replace(/(?:₽|руб\.?|р\.?|€|eur)$/iu, '');
    if (/^-?\d+(?:\.\d{1,3})?$/.test(t)) { nums.unshift(t); toks.pop(); }
    else if (/^[A-ZА-Я=*]$/u.test(toks[toks.length - 1]) && nums.length === 0) { toks.pop(); }
    else break;
  }
  const name = toks.join(' ');
  if (letterCount(name) < 2 || !nums.length) return null;
  const totalS = nums[nums.length - 1];
  if (decs(totalS) !== 2) return null;
  const total = Number(totalS);
  if (nums.length >= 3) {
    const a = nums[nums.length - 3], b = nums[nums.length - 2];
    if (near(Number(a) * Number(b), total)) {
      const { qty, price } = assignQty(a, b, decs(a) === 2 ? '*' : 'x', total);
      return { name: [name, ...nums.slice(0, -3)].join(' '), qty, price, total };
    }
  }
  if (nums.length >= 2) {
    const a = nums[nums.length - 2];
    if (decs(a) === 2 && near(Number(a), total)) return { name: [name, ...nums.slice(0, -2)].join(' '), qty: 1, price: total, total };
    if (decs(a) === 0 && Number(a) >= 2 && Number(a) <= 50) {
      const p = total / Number(a);
      if (Math.abs(p * 100 - Math.round(p * 100)) < 0.001) return { name: [name, ...nums.slice(0, -2)].join(' '), qty: Number(a), price: r2(p), total };
    }
    if (decs(a) === 3) return { name: [name, ...nums.slice(0, -2)].join(' '), qty: Number(a), price: r2(total / Number(a)), total };
  }
  return { name: [name, ...nums.slice(0, -1)].join(' '), qty: 1, price: total, total };
}

// ---------- дата, магазин, валюта ----------
export function findDate(lines, now = new Date()) {
  const maxY = now.getFullYear() + 1;
  const cands = [];
  lines.forEach((l, i) => {
    const s = l.replace(/\s+/g, ' ');
    let m;
    const r1 = /(?<!\d)(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4}|\d{2})(?![\d.])/g;
    while ((m = r1.exec(s))) {
      let d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= maxY) cands.push({ y, mo, d, i, score: /\d{1,2}:\d{2}/.test(s) || /дата|kuup|date/i.test(s) ? 2 : 1 });
    }
    const rIso = /(?<!\d)(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})(?!\d)/g;
    while ((m = rIso.exec(s))) {
      const y = +m[1], mo = +m[2], d = +m[3];
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y <= maxY) cands.push({ y, mo, d, i, score: 2 });
    }
  });
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || a.i - b.i);
  const c = cands[0];
  return `${c.y}-${String(c.mo).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}

export function findStore(lines) {
  const head = lines.slice(0, 15).join('\n');
  for (const s of STORES) {
    if (s.re.test(head)) return { name: s.name || null, hint: s.hint || null };
  }
  const all = lines.join('\n');
  for (const s of STORES) if (s.name && s.re.test(all)) return { name: s.name, hint: s.hint || null };
  for (const l of lines.slice(0, 6)) {
    if (letterCount(l) < 4) continue;
    if (SKIP_RE.test(l) && !/(ооо|оао|зао|ип|ао|as|oü|ou)\b/iu.test(l)) continue;
    if (HEADER_END.test(l) || TOTAL_RE.test(l)) continue;
    if (/(ул\.|улица|пр-?т|проспект|г\.\s|дом|tn\b|mnt\b|tänav|maantee|\d{5,})/iu.test(l)) continue;
    const name = l.replace(/[«»"']/g, '').replace(/^(ооо|оао|зао|пао|ао|ип)\s+/iu, '').replace(/\s+(as|oü|ou)$/iu, '').trim();
    if (name.length >= 3) return { name: cleanName(name), hint: null };
  }
  return { name: null, hint: null };
}

export function detectCurrency(text) {
  let rub = 0, eur = 0;
  if (/₽|руб|\bр\.|ккт|инн|фн\s*№|кассовый\s*чек|приход/iu.test(text)) rub += 2;
  if (/[а-яё]{4,}/iu.test(text)) rub += 1;
  if (/€|\beur\b|kokku|käibemaks|kmkr|tšekk|kviitung|aitäh|sularaha|kaardimakse|tasuda/iu.test(text)) eur += 3;
  if (rub === eur) return null;
  return rub > eur ? 'RUB' : 'EUR';
}

export function detectPayment(text) {
  const card = /(безналичн|оплата\s*карт|карт[аой]\s*[*\d]|kaart|pangakaart|kaardimakse|visa|mastercard|maestro|\bмир\b)/iu;
  const cash = /((?<!без)наличными\s*=?\s*[1-9]|sularaha\s*[1-9]|(?<!без)наличные\s*[1-9])/iu;
  if (cash.test(text) && !/(?<!без)наличными\s*=?\s*0\.00/iu.test(text)) return 'cash';
  if (card.test(text)) return 'card';
  return null;
}

// QR российского чека: t=20231015T1530&s=238.06&fn=...&i=...&fp=...&n=1
export function parseFiscalQR(str) {
  if (!str) return null;
  const t = str.match(/t=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/i);
  const s = str.match(/s=(\d+(?:\.\d{1,2})?)/i);
  if (!t || !s) return null;
  return { date: `${t[1]}-${t[2]}-${t[3]}`, time: `${t[4]}:${t[5]}`, total: Number(s[1]), raw: str };
}

// ---------- главный разбор ----------
export function parseReceipt(input, { lang = 'rus' } = {}) {
  const src = typeof input === 'string'
    ? input.split(/\r?\n/).map(t => ({ text: t, conf: null }))
    : input;
  const lines = src.map(l => ({ text: normalizeLine(l.text), conf: l.conf ?? null, raw: l.text })).filter(l => l.text);
  const texts = lines.map(l => l.text);
  const fullText = texts.join('\n');

  const items = [];
  let pending = [];      // строки названия без цены
  let pendingConf = [];
  let inItems = false;
  let total = null, totalLine = -1;
  let receiptDiscount = 0;
  const nameOnlyLines = [], numOnlyLines = [];

  const pushItem = (o, i, conf, kind) => {
    const it = {
      rawName: o.name, name: cleanName(o.name), qty: o.qty ?? 1, price: o.price ?? o.total, total: o.total,
      discount: 0, conf: conf, line: i, kind, doubts: [],
    };
    if (o.inconsistent) it.doubts.push('количество × цена ≠ сумма');
    items.push(it);
    inItems = true;
    return it;
  };
  const takePending = () => { const n = pending.join(' '); const c = pendingConf.filter(x => x != null); pending = []; pendingConf = []; return { name: n, conf: c.length ? Math.min(...c) : null }; };

  for (let i = 0; i < lines.length; i++) {
    const { text: line, conf } = lines[i];
    const letters = letterCount(line);

    // итог
    if (TOTAL_RE.test(line) && !TOTAL_EXCL.test(line)) {
      const fl = fixThousands(line);
      let v = anyMoney(fl);
      if (v == null && i + 1 < lines.length) v = anyMoney(fixThousands(lines[i + 1].text));
      if (v != null && v > 0) {
        if (total == null) { total = v; totalLine = i; }
        if (items.length) break; // после итога товаров уже нет
        continue;
      }
    }
    if (HEADER_END.test(line) && letters < 25) { inItems = true; pending = []; pendingConf = []; continue; }

    // скидки
    if (DISC_RE.test(line) || (/^-\d+\.\d{2}$/.test(line.replace(/\s/g, '')) && items.length)) {
      const v = anyMoney(line);
      if (v != null && v !== 0) {
        if (DISC_SUMMARY_RE.test(line)) receiptDiscount = Math.max(receiptDiscount, Math.abs(v));
        else if (items.length) {
          const last = items[items.length - 1];
          last.discount = r2(last.discount + Math.abs(v));
        }
      }
      continue;
    }
    if (SKIP_RE.test(line)) continue;

    // количество × цена
    const q = matchQty(line);
    if (q) {
      const nameLetters = letterCount(q.namePart);
      const last = items[items.length - 1];
      if (nameLetters >= 3 && !(pending.length && nameLetters < 4)) {
        pending = []; pendingConf = [];
        pushItem({ name: q.namePart, qty: q.qty, price: q.price, total: q.total, inconsistent: !q.consistent }, i, conf, 'qtyline');
      } else if (pending.length) {
        const p = takePending();
        pushItem({ name: p.name + (nameLetters ? ' ' + q.namePart : ''), qty: q.qty, price: q.price, total: q.total, inconsistent: !q.consistent }, i, minConf(p.conf, conf), 'name+qty');
      } else if (last && last.kind === 'priced' && !last.qtySet && i - last.line <= 2) {
        if (!q.hadTotal || near(q.total, last.total)) {
          last.qty = q.qty; last.price = q.price; last.qtySet = true;
          if (!near(r2(q.qty * q.price), last.total)) last.doubts.push('количество × цена ≠ сумма');
        } else {
          // число в конце строки названия оказалось частью названия (Coca-Cola 0.33)
          last.name = cleanName(last.rawLine || last.rawName);
          last.qty = q.qty; last.price = q.price; last.total = q.total; last.qtySet = true;
        }
      } else {
        const it = pushItem({ name: '', qty: q.qty, price: q.price, total: q.total, inconsistent: !q.consistent }, i, conf, 'orphan');
        it.doubts.push('не найдено название');
      }
      continue;
    }

    // только число
    const mo = line.match(MONEY_ONLY);
    if (mo) {
      const v = Number(mo[1]);
      numOnlyLines.push({ v, i });
      if (pending.length && v > 0) {
        const p = takePending();
        pushItem({ name: p.name, qty: 1, price: v, total: v }, i, minConf(p.conf, conf), 'name+num');
      } else if (v < 0 && items.length) {
        const last = items[items.length - 1];
        last.discount = r2(last.discount + Math.abs(v));
      }
      continue;
    }

    // название + цена в конце
    if (MONEY_END.test(line) && letters >= 2) {
      const t = matchTrailingNums(line);
      if (t && t.total > 0) {
        let name = t.name;
        if (pending.length && inItems && (/^[\p{Ll}\d(]/u.test(name) || /[-,]$/.test(pending[pending.length - 1]))) name = takePending().name + ' ' + name;
        pending = []; pendingConf = [];
        const it = pushItem({ name, qty: t.qty, price: t.price, total: t.total }, i, conf, 'priced');
        it.rawLine = line;
        if (t.qty !== 1) it.qtySet = true;
        continue;
      }
      if (t && t.total < 0 && items.length) {
        const last = items[items.length - 1];
        last.discount = r2(last.discount + Math.abs(t.total));
        continue;
      }
    }

    // строка названия
    if (letters >= 3) {
      nameOnlyLines.push({ text: line, i, conf });
      const indexed = /^\s*(?:№\s*)?\d{1,3}\s*[.)]\s+\p{L}/u.test(line);
      if (indexed || !inItems) { pending = [line]; pendingConf = [conf]; }
      else if (pending.length < 3) { pending.push(line); pendingConf.push(conf); }
      else { pending = [line]; pendingConf = [conf]; }
    }
  }

  // Live Text иногда выдаёт колонки по отдельности: сначала все названия, потом все цены.
  let columnMode = false;
  if (items.length < 2 && nameOnlyLines.length >= 2) {
    const names = nameOnlyLines.filter(n => n.i < (totalLine >= 0 ? totalLine : 1e9) && !TOTAL_RE.test(n.text));
    let nums = numOnlyLines.filter(n => n.v > 0).map(n => n.v);
    if (total != null) {
      const idx = nums.lastIndexOf(total);
      if (idx >= 0 && nums.length > names.length) nums = nums.slice(0, idx);
    }
    if (names.length >= 2 && nums.length >= names.length) {
      const take = nums.slice(0, names.length);
      items.length = 0;
      names.forEach((n, k) => {
        const it = pushItem({ name: n.text, qty: 1, price: take[k], total: take[k] }, n.i, n.conf, 'column');
        it.doubts.push('проверьте соответствие цены');
      });
      columnMode = true;
    }
  }

  // скидки по позициям: total — уже со скидкой
  for (const it of items) {
    if (it.discount) it.total = r2(it.total - it.discount);
  }
  const sumNet = r2(items.reduce((s, it) => s + it.total, 0));
  if (total != null && items.length) {
    const sumGross = r2(items.reduce((s, it) => s + it.total + it.discount, 0));
    if (!near(sumNet, total, 0.011) && near(sumGross, total, 0.011)) {
      // строки «скидка» были справочными — цены уже со скидкой
      for (const it of items) { it.total = r2(it.total + it.discount); it.discount = 0; }
    } else if (!near(sumNet, total, 0.011) && receiptDiscount && near(sumNet - receiptDiscount, total, 0.011)) {
      distributeDiscount(items, receiptDiscount);
    }
  }

  // сомнения
  for (const it of items) {
    if (it.conf != null && it.conf < 70) it.doubts.push('OCR не уверен');
    const lc = letterCount(it.name);
    if (lc < 3) { if (!it.doubts.includes('не найдено название')) it.doubts.push('неразборчивое название'); }
    else if (lc / Math.max(1, it.name.replace(/\s/g, '').length) < 0.5) it.doubts.push('неразборчивое название');
    if (!(it.total > 0)) it.doubts.push('нулевая сумма');
    if (total != null && it.total > total + 0.01) it.doubts.push('больше итога чека');
    if (it.qty > 0 && !it.discount && !near(r2(it.qty * it.price), it.total) && !it.doubts.includes('количество × цена ≠ сумма')) it.doubts.push('количество × цена ≠ сумма');
    it.qty = Number(it.qty.toFixed(3));
    it.price = r2(it.price);
  }

  const store = findStore(texts);
  return {
    store: store.name,
    storeHint: store.hint,
    date: findDate(texts),
    total,
    totalFound: total != null,
    currency: detectCurrency(fullText) || (lang === 'est' ? 'EUR' : 'RUB'),
    payment: detectPayment(fullText),
    receiptDiscount,
    columnMode,
    items: items.map(({ rawLine, rawName, kind, line, qtySet, ...rest }) => rest),
    text: lines.map(l => l.raw).join('\n'),
  };
}

function minConf(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

export function distributeDiscount(items, amount) {
  const sum = items.reduce((s, it) => s + it.total, 0);
  if (sum <= 0) return;
  let left = amount;
  items.forEach((it, k) => {
    const d = k === items.length - 1 ? r2(left) : r2(amount * it.total / sum);
    left = r2(left - d);
    it.discount = r2(it.discount + d);
    it.total = r2(it.total - d);
  });
}
