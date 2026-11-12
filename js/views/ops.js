// Операции: период, сводка по категориям (с раскрытием подкатегорий), список по дням,
// карточка операции (#ops/<id>) с кнопками «Изменить» и «Удалить».
import { iconHtml, iconText, mascot } from '../icons.js';
import { state, opsInRange, getOp, deleteOp, summarize, cat, topCat, setSetting } from '../store.js';
import { PAY_METHODS } from '../categories.js';
import {
  esc, money, todayISO, monthKey, dayLabel, fmtDate, periodRange, shiftPeriod, monthLabel,
  addMonths, CURRENCIES, curSymbol, plural, numStr,
} from '../util.js';

const CARET = `<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
const ARR_L = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>`;
const ARR_R = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

// Состояние экрана живёт между перерисовками (перерисовка идёт после каждого изменения данных).
const ui = {
  period: { mode: 'month', month: monthKey(todayISO()), year: new Date().getFullYear(), from: '', to: '' },
  catTab: 'expense',        // 'expense' | 'income'
  open: new Set(),          // раскрытые категории верхнего уровня
};

export async function render(el, { param } = {}) {
  const cur = state.settings.currency;
  if (ui.period.mode === 'custom' && !ui.period.from) {
    ui.period.to = todayISO();
    ui.period.from = `${monthKey(ui.period.to)}-01`;
  }

  async function draw() {
    const range = periodRange(ui.period);
    const list = await opsInRange(range.from, range.to, cur);
    const s = summarize(list);
    const op = param ? await getOp(decodeURIComponent(param)) : undefined;

    el.innerHTML = `
      ${header(cur)}
      ${periodBar(range)}
      ${totalsCard(s, cur)}
      ${categoriesCard(s, cur)}
      ${daysCard(list, cur)}
      ${op ? sheet(op, cur) : ''}`;
    bind(list);
  }

  function bind(list) {
    el.querySelector('#cur').addEventListener('change', e => setSetting('currency', e.target.value));

    el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      const p = ui.period, m = b.dataset.mode;
      if (m === p.mode) return;
      if (m === 'year' && p.mode === 'month') p.year = Number(p.month.slice(0, 4));
      if (m === 'month' && p.mode === 'year') p.month = `${p.year}-${monthKey(todayISO()).slice(5)}`;
      p.mode = m;
      draw();
    }));
    el.querySelectorAll('[data-shift]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      ui.period = shiftPeriod(ui.period, Number(b.dataset.shift));
      draw();
    }));
    el.querySelectorAll('[data-date]').forEach(i => i.addEventListener('change', () => {
      if (!i.value) return;
      ui.period[i.dataset.date] = i.value;
      if (ui.period.from > ui.period.to) {
        if (i.dataset.date === 'from') ui.period.to = i.value; else ui.period.from = i.value;
      }
      draw();
    }));
    el.querySelectorAll('[data-cattab]').forEach(b => b.addEventListener('click', () => {
      ui.catTab = b.dataset.cattab;
      draw();
    }));
    el.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.toggle;
      if (!ui.open.delete(id)) ui.open.add(id);
      draw();
    }));

    // карточка операции
    const close = () => { location.hash = '#ops'; };
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    const del = el.querySelector('#del');
    if (del) {
      const id = decodeURIComponent(param);
      del.addEventListener('click', () => {
        el.querySelector('.sheet-actions').hidden = true;
        el.querySelector('.sheet-confirm').hidden = false;
      });
      el.querySelector('#del-no').addEventListener('click', () => {
        el.querySelector('.sheet-actions').hidden = false;
        el.querySelector('.sheet-confirm').hidden = true;
      });
      el.querySelector('#del-yes').addEventListener('click', async () => {
        location.hash = '#ops';   // сначала закрываем карточку, потом удаляем — перерисовка уже без неё
        await deleteOp(id);
      });
    }
  }

  await draw();
}

// ---------- шапка и период ----------
function header(cur) {
  const list = state.settings.currencies.includes(cur) ? state.settings.currencies : [cur, ...state.settings.currencies];
  const opts = list.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(curSymbol(c))} ${esc(c)} — ${esc(CURRENCIES[c]?.name || c)}</option>`).join('');
  return `
    <header class="top">
      <h1 class="page-title">Операции</h1>
      <label class="chip" title="Валюта">
        <span class="num">${esc(curSymbol(cur))} ${esc(cur)}</span>${CARET}
        <select id="cur" aria-label="Валюта отображения">${opts}</select>
      </label>
    </header>`;
}

function periodBar(range) {
  const p = ui.period;
  const modes = [['month', 'Месяц'], ['year', 'Год'], ['all', 'Всё'], ['custom', 'Даты']];
  const seg = modes.map(([m, t]) => `<button type="button" class="${p.mode === m ? 'on' : ''}" data-mode="${m}">${t}</button>`).join('');
  let nav = '';
  if (p.mode === 'month' || p.mode === 'year') {
    const nowM = monthKey(todayISO()), nowY = new Date().getFullYear();
    const atEnd = p.mode === 'month' ? p.month >= nowM : p.year >= nowY;
    nav = `
      <div class="pnav">
        <button type="button" class="icon-btn" data-shift="-1" aria-label="Назад">${ARR_L}</button>
        <div class="plabel">${esc(range.label)}</div>
        <button type="button" class="icon-btn" data-shift="1" aria-label="Вперёд"${atEnd ? ' disabled' : ''}>${ARR_R}</button>
      </div>`;
  } else if (p.mode === 'custom') {
    nav = `
      <div class="pdates">
        <label>С <input type="date" data-date="from" value="${esc(p.from)}" max="${esc(p.to)}"></label>
        <label>По <input type="date" data-date="to" value="${esc(p.to)}" min="${esc(p.from)}"></label>
      </div>`;
  } else {
    nav = `<div class="pnav"><div class="plabel">Всё время</div></div>`;
  }
  return `<section class="pbar"><div class="seg" role="group" aria-label="Период">${seg}</div>${nav}</section>`;
}

// ---------- итоги и категории ----------
function totalsCard(s, cur) {
  const rest = s.income - s.expense;
  return `
    <section class="card totals">
      <div class="hero-stat">
        <div class="k"><span class="dot" style="background:var(--accent)"></span>Расходы</div>
        <div class="v num">${money(s.expense, cur)}</div>
      </div>
      <div class="hero-stat">
        <div class="k"><span class="dot" style="background:var(--income-fill)"></span>Доходы</div>
        <div class="v num">${money(s.income, cur)}</div>
      </div>
      <div class="hero-stat">
        <div class="k">Разница</div>
        <div class="v num${rest > 0 ? ' pos' : ''}">${money(rest, cur, { sign: true })}</div>
      </div>
    </section>`;
}

function categoriesCard(s, cur) {
  const inc = ui.catTab === 'income';
  const top = inc ? s.incomeTop : s.expenseTop;
  const total = inc ? s.income : s.expense;
  const tabs = `
    <div class="seg seg-sm" role="group">
      <button type="button" class="${inc ? '' : 'on'}" data-cattab="expense">Расходы</button>
      <button type="button" class="${inc ? 'on' : ''}" data-cattab="income">Доходы</button>
    </div>`;
  if (!top.length) {
    return `
      <section class="card">
        <div class="card-head"><h2>Категории</h2>${tabs}</div>
        <div class="empty">${inc ? 'Доходов' : 'Расходов'} за этот период нет</div>
      </section>`;
  }
  const maxShare = top.reduce((m, x) => Math.max(m, x.share), 0) || 1;
  const stack = top.map(x => `<span style="flex:${Math.max(x.share, 0.005)};background:${cat(x.cat).color}"></span>`).join('');

  const rows = top.map(x => {
    const c = cat(x.cat);
    // подкатегории — только у расходов (у дохода разбивки нет)
    const subs = inc ? [] : [...s.expenseLeaf]
      .filter(([id, v]) => topCat(id).id === x.cat && Math.abs(v) >= 0.01)
      .sort((a, b) => b[1] - a[1]);
    const expandable = subs.length > 1 || (subs.length === 1 && subs[0][0] !== x.cat);
    const open = expandable && ui.open.has(x.cat);
    const head = `
      <${expandable ? 'button type="button" data-toggle="' + esc(x.cat) + '"' : 'div'} class="cat-row${expandable ? ' tap' : ''}"${expandable ? ` aria-expanded="${open}"` : ''}>
        <span class="ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span>
        <div class="cat-main">
          <div class="cat-name"><span>${esc(c.name)}${expandable ? ' ' + CARET : ''}</span><span class="share num">${pct(x.share)}</span></div>
          <div class="bar"><span style="width:${(x.share / maxShare) * 100}%;background:${c.color}"></span></div>
        </div>
        <div class="cat-sum num">${money(x.sum, cur)}</div>
      </${expandable ? 'button' : 'div'}>`;
    const sub = open ? `<div class="subs">${subs.map(([id, v]) => {
      const sc = cat(id);
      return `<div class="sub-row"><span class="sub-ico" style="--c:${sc.color}">${iconHtml(sc.icon)}</span><span class="sub-name">${esc(id === x.cat ? 'Без подкатегории' : sc.name)}</span><span class="num">${money(v, cur)}</span></div>`;
    }).join('')}</div>` : '';
    return head + sub;
  }).join('');

  return `
    <section class="card">
      <div class="card-head"><h2>Категории</h2>${tabs}</div>
      ${top.length > 1 ? `<div class="stack" role="img" aria-label="Доли категорий">${stack}</div>` : ""}
      ${rows}
      <div class="cat-total"><span>Итого</span><span class="num">${money(total, cur)}</span></div>
    </section>`;
}

// ---------- список по дням ----------
function daysCard(list, cur) {
  if (!list.length) {
    return `
      <section class="card">
        <div class="empty">
          <span class="big">${mascot(220, 'b')}</span>
          За этот период операций нет.
          <br><a class="btn" href="#add">Добавить</a>
        </div>
      </section>`;
  }
  const groups = new Map();
  for (const o of list) {
    if (!groups.has(o.date)) groups.set(o.date, []);
    groups.get(o.date).push(o);
  }
  const html = [...groups].map(([date, ops]) => {
    const net = ops.reduce((a, o) => a + (o.type === 'income' ? o.amount : -o.amount), 0);
    return `
      <section class="card day">
        <div class="day-head"><span>${esc(dayLabel(date))}</span><span class="num${net > 0 ? ' pos' : ''}">${money(net, cur, { sign: true })}</span></div>
        ${ops.map(o => opRow(o, cur)).join('')}
      </section>`;
  }).join('');
  return `<div class="days-count">${list.length} ${plural(list.length, 'операция', 'операции', 'операций')}</div>${html}`;
}

function opRow(o, cur) {
  const c = cat(o.cat);
  const title = o.store || o.note || c.name;
  const sub = [title !== c.name ? c.name : null, o.items?.length ? `${o.items.length} поз.` : null].filter(Boolean).join(' · ');
  const inc = o.type === 'income';
  return `
    <a class="op-row" href="#ops/${encodeURIComponent(o.id)}">
      <span class="ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span>
      <div style="min-width:0">
        <div class="op-title">${esc(title)}</div>
        ${sub ? `<div class="op-sub">${esc(sub)}</div>` : ''}
      </div>
      <div class="op-sum num${inc ? ' pos' : ''}">${money(inc ? o.amount : -o.amount, cur, { sign: inc })}</div>
    </a>`;
}

// ---------- карточка операции ----------
function sheet(o, cur) {
  const c = cat(o.cat);
  const inc = o.type === 'income';
  const pay = PAY_METHODS.find(p => p.id === o.pay);
  const detail = [
    ['Дата', fmtDate(o.date, true)],
    ['Категория', `${iconText(c.icon)} ${c.name}`.trim()],
    o.store ? ['Магазин', o.store] : null,
    pay ? ['Оплата', pay.name] : null,
    o.note ? ['Заметка', o.note] : null,
  ].filter(Boolean).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');

  let items = '';
  if (o.items?.length) {
    const rows = o.items.map(it => {
      const ic = cat(it.cat);
      const qty = Number(it.qty) !== 1 && it.qty ? `${numStr(it.qty)} × ${money(it.price, cur)}` : '';
      return `
        <div class="item-row">
          <span class="sub-ico" style="--c:${ic.color}">${iconHtml(ic.icon)}</span>
          <div class="item-main"><div class="item-name">${esc(it.name)}</div>${qty ? `<div class="op-sub num">${qty}</div>` : ''}</div>
          <span class="num">${money(it.total, cur)}</span>
        </div>`;
    }).join('');
    items = `<div class="sheet-sec"><h3>Позиции чека</h3>${rows}</div>`;
  }

  return `
    <div class="sheet-wrap">
      <div class="scrim" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Операция">
        <div class="sheet-grab"></div>
        <div class="sheet-top">
          <span class="ico big-ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span>
          <div class="sheet-sum num${inc ? ' pos' : ''}">${money(inc ? o.amount : -o.amount, cur, { sign: inc })}</div>
          <div class="op-sub">${inc ? 'Доход' : 'Расход'}</div>
        </div>
        <div class="sheet-sec">${detail}</div>
        ${items}
        <div class="sheet-actions">
          <a class="btn" href="#add/${encodeURIComponent(o.id)}">Изменить</a>
          <button type="button" class="btn btn-ghost" id="del">Удалить</button>
        </div>
        <div class="sheet-confirm" hidden>
          <div>Удалить эту операцию? Вернуть её будет нельзя.</div>
          <div class="sheet-actions">
            <button type="button" class="btn btn-danger" id="del-yes">Да, удалить</button>
            <button type="button" class="btn btn-ghost" id="del-no">Отмена</button>
          </div>
        </div>
        <button type="button" class="sheet-close" data-close aria-label="Закрыть">✕</button>
      </div>
    </div>`;
}

function pct(share) {
  const p = share * 100;
  if (p > 0 && p < 1) return '<1%';
  return Math.round(p) + '%';
}
