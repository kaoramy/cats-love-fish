// Добавить: ручной ввод и скан чека (#add) либо изменение операции (#add/<id>).
// Скан: фото → QR + OCR → разбор → проверка позиций → сохранение. Всё локально.
import { iconHtml, iconText, mascot } from '../icons.js';
import { state, getOp, saveOp, learnDict, topCats, subCats, cat, topCat } from '../store.js';
import { classify } from '../classifier.js';
import { loadImage, drawToCanvas, preprocess, scanQR, recognize, LANGS, isPdf, readPdf } from '../ocr.js';
import { parseReceipt } from '../parser.js';
import { PAY_METHODS } from '../categories.js';
import { esc, money, todayISO, parseNum, round2, CURRENCIES, curSymbol, numStr } from '../util.js';

// ---------- суммы с разделением тысяч: 3 000, 12 345,50 ----------
const groupInt = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function fmtNum(v) {
  const [i, f] = (Number(v) || 0).toFixed(2).split('.');
  return groupInt(i) + (f === '00' ? '' : ',' + f);
}
// Форматирует поле на лету и возвращает курсор на то же место.
function maskMoney(inp) {
  const v = inp.value;
  const pos = inp.selectionStart ?? v.length;
  const sigBefore = v.slice(0, pos).replace(/[^\d.,]/g, '').length;
  const s = v.replace(/[^\d.,]/g, '');
  const m = s.search(/[.,]/);
  let int = m >= 0 ? s.slice(0, m) : s;
  const frac = m >= 0 ? s.slice(m + 1).replace(/[.,]/g, '').slice(0, 2) : null;
  int = int.replace(/^0+(?=\d)/, '');
  if (!int && frac !== null) int = '0';
  const out = groupInt(int) + (frac !== null ? ',' + frac : '');
  if (out === v) return;
  inp.value = out;
  let c = 0, k = 0;
  while (k < out.length && c < sigBefore) { if (/[\d,]/.test(out[k])) c++; k++; }
  try { inp.setSelectionRange(k, k); } catch (e) { /* поле без выделения */ }
}

export async function render(el, { param } = {}) {
  const editId = param ? decodeURIComponent(param) : null;
  const S = {
    mode: 'manual',            // 'manual' | 'scan'
    phase: 'pick',             // сканирование: 'pick' | 'busy' | 'review'
    lang: 'rus',
    type: 'expense',
    amount: '',
    currency: state.settings.currency,
    date: todayISO(),
    cat: 'food',
    store: '', note: '', pay: null,
    items: [],
    warns: [], rawText: '', thumb: '',
    error: '',
    editOp: null,
  };

  if (editId) {
    const op = await getOp(editId);
    if (op) {
      S.editOp = op;
      Object.assign(S, {
        type: op.type, amount: fmtNum(op.amount), currency: op.currency, date: op.date, cat: op.cat,
        store: op.store || '', note: op.note || '', pay: op.pay || null,
        items: (op.items || []).map(it => ({ ...it, total: it.total, auto: it.cat, doubts: [] })),
      });
    }
  }

  const validCats = () => new Set(state.cats.filter(c => c.type === 'expense' && !c.hidden).map(c => c.id));
  const itemsSum = () => round2(S.items.reduce((a, it) => a + (Number(it.total) || 0), 0));

  // ---------- отрисовка ----------
  function draw() {
    const isEdit = !!S.editOp;
    const showForm = isEdit || S.mode === 'manual' || S.phase === 'review';
    el.innerHTML = `
      <header class="top"><h1 class="page-title">${isEdit ? 'Изменить' : 'Добавить'}</h1>
        ${isEdit ? '<a class="link" href="#ops">Отмена</a>' : ''}</header>
      ${!isEdit && S.phase !== 'review' ? modeSwitch() : ''}
      ${!isEdit && S.mode === 'scan' && S.phase === 'pick' ? pickCard() : ''}
      ${S.phase === 'busy' ? busyCard() : ''}
      ${S.phase === 'review' ? reviewNotes() : ''}
      ${showForm && S.phase !== 'busy' ? formCard() : ''}
      ${showForm && S.phase !== 'busy' && (S.items.length || S.phase === 'review') ? itemsCard() : ''}
      ${showForm && S.phase !== 'busy' ? `
        <div class="form-err" id="err"${S.error ? '' : ' hidden'}>${esc(S.error)}</div>
        <button type="button" class="btn btn-wide" id="save">${isEdit ? 'Сохранить' : 'Добавить операцию'}</button>` : ''}`;
  }

  function modeSwitch() {
    return `<div class="seg" role="group">
      <button type="button" class="${S.mode === 'manual' ? 'on' : ''}" data-mode="manual">Вручную</button>
      <button type="button" class="${S.mode === 'scan' ? 'on' : ''}" data-mode="scan">Скан чека</button>
    </div>`;
  }

  function pickCard() {
    const langs = Object.entries(LANGS).map(([k, v]) => `<button type="button" class="${S.lang === k ? 'on' : ''}" data-lang="${k}">${esc(v.label)}</button>`).join('');
    return `
      <section class="card scan-card">
        <span class="big">${mascot(220, 'b')}</span>
        <p>Сфотографируйте чек, выберите снимок или PDF. Если на чеке есть QR-код, дата и сумма возьмутся из него.</p>
        <div class="seg seg-sm" role="group" aria-label="Язык чека">${langs}</div>
        <label class="btn btn-wide">Фото или PDF
          <input type="file" id="file" accept="image/*,application/pdf,.pdf" hidden>
        </label>
        <p class="hint">Первый запуск читает чек дольше. Всё работает на телефоне, ничего не отправляется.</p>
      </section>
      ${S.error ? `<div class="form-err">${esc(S.error)}</div>` : ''}`;
  }

  function busyCard() {
    return `
      <section class="card scan-card">
        <span class="big pulse">${mascot(200, 'c')}</span>
        <div id="pstat" class="pstat">Открываю фото…</div>
        <div class="pbar-track"><span id="pfill" style="width:3%"></span></div>
      </section>`;
  }

  function reviewNotes() {
    const warns = S.warns.map(w => `<li>${esc(w)}</li>`).join('');
    return `
      ${warns ? `<section class="card warn-card"><ul>${warns}</ul></section>` : ''}
      ${S.thumb || S.rawText ? `
      <details class="card raw">
        <summary>Фото и распознанный текст</summary>
        ${S.thumb ? `<img src="${esc(S.thumb)}" alt="Фото чека">` : ''}
        <pre>${esc(S.rawText)}</pre>
      </details>` : ''}`;
  }

  function formCard() {
    const inc = S.type === 'income';
    const cur = [...new Set([S.currency, ...state.settings.currencies, ...Object.keys(CURRENCIES)])]
      .map(c => `<option value="${esc(c)}"${c === S.currency ? ' selected' : ''}>${esc(curSymbol(c))} ${esc(c)}</option>`).join('');
    const cats = topCats(S.type).map(c => `
      <button type="button" class="catpick${c.id === S.cat ? ' on' : ''}" data-cat="${esc(c.id)}">
        <span class="ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span><span>${esc(c.name)}</span>
      </button>`).join('');
    const pays = PAY_METHODS.map(p => `<button type="button" class="${S.pay === p.id ? 'on' : ''}" data-pay="${p.id}">${esc(p.name)}</button>`).join('');
    return `
      <section class="card form">
        <div class="seg" role="group">
          <button type="button" class="${inc ? '' : 'on'}" data-type="expense">Расход</button>
          <button type="button" class="${inc ? 'on' : ''}" data-type="income">Доход</button>
        </div>
        <div class="amount-row">
          <input class="amount" id="amount" data-f="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(S.amount)}" aria-label="Сумма">
          <label class="chip cur-chip"><span>${esc(curSymbol(S.currency))}</span>
            <select data-f="currency" aria-label="Валюта">${cur}</select></label>
        </div>
        <label class="field"><span>Дата</span><input type="date" data-f="date" value="${esc(S.date)}"></label>
        <div class="field"><span>${S.items.length || S.phase === 'review' ? 'Категория остатка' : 'Категория'}</span>
          <div class="catgrid">${cats}</div></div>
        <label class="field"><span>${inc ? 'Источник' : 'Магазин'}</span><input type="text" data-f="store" value="${esc(S.store)}" placeholder="${inc ? 'Например, работодатель' : 'Например, Пятёрочка'}"></label>
        <label class="field"><span>Заметка</span><input type="text" data-f="note" value="${esc(S.note)}" placeholder="Необязательно"></label>
        ${inc ? '' : `<div class="field"><span>Оплата</span><div class="seg seg-sm" role="group">${pays}</div></div>`}
      </section>`;
  }

  function catOptions(sel) {
    const food = subCats('food').map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(iconText(c.icon))} ${esc(c.name)}</option>`).join('');
    const rest = topCats('expense').filter(c => c.id !== 'food')
      .map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(iconText(c.icon))} ${esc(c.name)}</option>`).join('');
    return `<optgroup label="Продукты">${food}</optgroup><optgroup label="Другое">${rest}</optgroup>`;
  }

  function itemsCard() {
    const rows = S.items.map((it, i) => `
      <div class="it${it.doubts?.length ? ' warn' : ''}">
        <div class="it-top">
          <input class="it-name" data-i="${i}" data-k="name" value="${esc(it.name)}" placeholder="Название">
          <button type="button" class="it-del" data-del="${i}" aria-label="Убрать позицию">✕</button>
        </div>
        <div class="it-bot">
          <select data-i="${i}" data-k="cat" aria-label="Категория">${catOptions(it.cat)}</select>
          <input class="it-sum" data-i="${i}" data-k="total" inputmode="decimal" value="${esc(fmtNum(it.total))}" aria-label="Сумма">
        </div>
        ${Number(it.qty) !== 1 && it.qty ? `<div class="op-sub num">${numStr(it.qty)} × ${money(it.price, S.currency)}</div>` : ''}
        ${it.doubts?.length ? `<div class="it-doubt">⚠ ${esc(it.doubts.join(', '))}</div>` : ''}
      </div>`).join('');
    return `
      <section class="card">
        <div class="card-head"><h2>Позиции чека</h2><button type="button" class="link link-btn" id="add-item">+ Позиция</button></div>
        ${rows || '<div class="empty">Позиций нет. Можно добавить вручную или сохранить одной суммой.</div>'}
        <div class="sumline" id="sumline"></div>
      </section>`;
  }

  function refreshSum() {
    const n = el.querySelector('#sumline');
    if (!n) return;
    const sum = itemsSum(), amt = parseNum(S.amount);
    if (!S.items.length) { n.textContent = ''; return; }
    const diff = Number.isFinite(amt) ? round2(amt - sum) : NaN;
    n.className = 'sumline num' + (Number.isFinite(diff) && Math.abs(diff) >= 0.01 ? ' bad' : '');
    n.textContent = `Сумма позиций ${money(sum, S.currency)}` + (Number.isFinite(diff) && Math.abs(diff) >= 0.01
      ? ` · ${diff > 0 ? 'не хватает' : 'лишние'} ${money(Math.abs(diff), S.currency)} до суммы чека` : ' · сходится с суммой чека');
  }

  // ---------- события ----------
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f === 'amount' || t.dataset.k === 'total') maskMoney(t);
    if (t.dataset.f) {
      S[t.dataset.f] = t.value;
      if (t.dataset.f === 'currency') {
        const sym = el.querySelector('.cur-chip span');
        if (sym) sym.textContent = curSymbol(t.value);
      }
      if (t.dataset.f === 'amount') refreshSum();
    } else if (t.dataset.i !== undefined) {
      const it = S.items[Number(t.dataset.i)];
      const k = t.dataset.k;
      if (k === 'total') {
        const v = parseNum(t.value);
        it.total = Number.isFinite(v) ? v : 0;
        if (it.total > 0 && it.qty > 0) it.price = round2(it.total / it.qty);
        refreshSum();
      } else it[k] = t.value;
    }
  });

  el.addEventListener('click', async e => {
    const b = e.target.closest('button, label.btn');
    if (!b) return;
    const d = b.dataset;
    if (d.mode) { S.mode = d.mode; S.error = ''; draw(); refreshSum(); }
    else if (d.lang) { S.lang = d.lang; draw(); }
    else if (d.type) {
      if (S.type !== d.type) { S.type = d.type; S.cat = topCats(S.type)[0]?.id || 'other'; if (S.type === 'income') S.pay = null; }
      draw(); refreshSum();
    }
    else if (d.cat) { S.cat = d.cat; el.querySelectorAll('.catpick').forEach(x => x.classList.toggle('on', x.dataset.cat === d.cat)); }
    else if (d.pay) {
      S.pay = S.pay === d.pay ? null : d.pay;
      el.querySelectorAll('[data-pay]').forEach(x => x.classList.toggle('on', x.dataset.pay === S.pay));
    }
    else if (d.del !== undefined) { S.items.splice(Number(d.del), 1); draw(); refreshSum(); }
    else if (b.id === 'add-item') {
      S.items.push({ name: '', qty: 1, price: 0, total: 0, cat: 'food.other', auto: 'food.other', doubts: [] });
      draw(); refreshSum();
      const names = el.querySelectorAll('.it-name');
      names[names.length - 1]?.focus();
    }
    else if (b.id === 'save') await save();
  });

  el.addEventListener('change', e => {
    if (e.target.id === 'file' && e.target.files[0]) scan(e.target.files[0]);
  });

  // ---------- сохранение ----------
  async function save() {
    const amount = parseNum(S.amount);
    const items = S.items
      .filter(it => (it.name || '').trim() && it.total > 0)
      .map(it => ({ name: it.name.trim(), qty: it.qty || 1, price: it.price || it.total, total: round2(it.total), cat: it.cat }));
    const fail = msg => {
      S.error = msg;
      const n = el.querySelector('#err');
      if (n) { n.textContent = msg; n.hidden = false; n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
    if (!(amount > 0)) return fail('Введите сумму больше нуля.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(S.date)) return fail('Выберите дату.');
    const sum = items.reduce((a, it) => a + it.total, 0);
    if (items.length && sum > amount + 0.011) return fail(`Сумма позиций (${money(sum, S.currency)}) больше суммы чека. Поправьте сумму или позиции.`);

    const op = {
      ...(S.editOp || {}),
      type: S.type, date: S.date, amount, currency: S.currency, cat: S.cat,
      note: S.note.trim(), store: S.store.trim(), pay: S.type === 'income' ? null : S.pay,
    };
    if (items.length && S.type === 'expense') op.items = items; else delete op.items;
    await saveOp(op);

    // учимся на исправлениях: категория товара изменена вручную
    for (const it of S.items) {
      if ((it.name || '').trim() && it.cat !== it.auto) {
        try { await learnDict(it.name, it.cat); } catch (e) { console.warn(e); }
      }
    }
    location.hash = '#ops';
  }

  // ---------- скан ----------
  function progress(text, p) {
    if (!el.isConnected) return;
    const s = el.querySelector('#pstat'), f = el.querySelector('#pfill');
    if (s) s.textContent = text;
    if (f) f.style.width = Math.max(3, Math.round(p * 100)) + '%';
  }

  async function scan(file) {
    S.phase = 'busy'; S.error = ''; draw();
    try {
      progress('Открываю файл…', 0.02);
      let img, res, qr = null;
      const pdf = isPdf(file) ? await readPdf(file, progress) : null;
      if (pdf && pdf.lines) {
        // PDF с текстом: OCR не нужен
        S.thumb = '';
        res = { lines: pdf.lines, text: pdf.lines.map(l => l.text).join('\n') };
      } else {
        if (pdf) { img = pdf.canvas; S.thumb = img.toDataURL('image/jpeg', 0.7); }
        else { img = await loadImage(file); S.thumb = URL.createObjectURL(file); }
        progress('Ищу QR-код…', 0.05);
        qr = await scanQR(img);
        const canvas = preprocess(drawToCanvas(img));
        res = await recognize(canvas, S.lang, progress);
      }
      const parsed = parseReceipt(res.lines, { lang: S.lang });
      if (!el.isConnected) return;

      const valid = validCats();
      S.items = parsed.items.map(it => {
        const c = classify(it.name, state.userDict, { storeHint: parsed.storeHint, validCats: valid });
        const doubts = [...it.doubts];
        if (!c.sure) doubts.push('категория угадана неуверенно');
        return { name: it.name, qty: it.qty, price: it.price, total: it.total, cat: c.cat, auto: c.cat, doubts };
      });
      const sum = itemsSum();
      const total = parsed.total ?? qr?.total ?? (sum || null);
      S.warns = [];
      if (qr?.total != null && parsed.total != null && Math.abs(qr.total - parsed.total) > 0.011) {
        S.warns.push(`Итог в тексте (${money(parsed.total, parsed.currency)}) не совпал с QR-кодом (${money(qr.total, parsed.currency)}). Взят итог из QR.`);
      }
      const finalTotal = qr?.total ?? total;
      if (!S.items.length) S.warns.push('Позиции не нашлись. Добавьте их вручную или сохраните одной суммой.');
      else if (finalTotal != null && Math.abs(sum - finalTotal) > 0.011) S.warns.push(`Сумма позиций ${money(sum, parsed.currency)} не равна итогу ${money(finalTotal, parsed.currency)}. Проверьте подсвеченные строки.`);
      if (!parsed.totalFound && !qr) S.warns.push('Итог чека не найден, проверьте сумму.');

      Object.assign(S, {
        type: 'expense', phase: 'review', cat: topCat(parsed.storeHint || 'food').id,
        amount: finalTotal != null ? fmtNum(finalTotal) : '',
        currency: parsed.currency || S.currency,
        date: qr?.date || parsed.date || todayISO(),
        store: parsed.store || '', pay: parsed.payment || null, note: '',
        rawText: parsed.text || res.text || '',
      });
      if (parsed.currency && !state.settings.currencies.includes(parsed.currency)) S.warns.push(`Валюта чека — ${parsed.currency}.`);
      draw(); refreshSum();
      window.scrollTo(0, 0);
    } catch (err) {
      console.error(err);
      if (!el.isConnected) return;
      S.phase = 'pick';
      S.error = 'Не получилось прочитать чек: ' + (err.message || err);
      draw();
    }
  }

  draw();
  refreshSum();
}
