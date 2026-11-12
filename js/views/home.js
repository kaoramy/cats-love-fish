// Главная: итог текущего месяца в выбранной валюте, категории, последние операции.
import { iconHtml, mascot } from '../icons.js';
import { sparkle } from '../grain.js';
import { state, opsInRange, allOps, summarize, cat, setSetting } from '../store.js';
import {
  esc, money, todayISO, monthKey, addMonths, lastDayOfMonth, fmtDate, isoDate,
  MONTHS_PREP, CURRENCIES, curSymbol,
} from '../util.js';

const TOP_N = 5;

const GEAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
const CARET = `<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

export async function render(el) {
  const cur = state.settings.currency;
  const today = todayISO();
  const mk = monthKey(today);
  const day = Number(today.slice(8));

  // для сравнения: те же дни прошлого месяца (1-е … сегодняшнее число)
  const pmk = addMonths(mk, -1);
  const pLast = lastDayOfMonth(pmk);
  const pTo = `${pmk}-${String(Math.min(day, Number(pLast.slice(8)))).padStart(2, '0')}`;

  const [monthOps, prevOps, everything] = await Promise.all([
    opsInRange(`${mk}-01`, lastDayOfMonth(mk), cur),
    opsInRange(`${pmk}-01`, pTo, cur),
    allOps(cur),
  ]);
  const s = summarize(monthOps);
  const prev = summarize(prevOps);
  const monthIdx = Number(mk.slice(5)) - 1;

  el.innerHTML = `
    ${header(cur)}
    ${hero(s, prev, cur, monthIdx)}
    ${categoriesCard(s, cur)}
    ${recentCard(everything.slice(0, 5), cur, everything.length)}
  `;

  el.querySelector('#cur').addEventListener('change', e => setSetting('currency', e.target.value));
}

function header(cur) {
  const list = state.settings.currencies.includes(cur) ? state.settings.currencies : [cur, ...state.settings.currencies];
  const opts = list.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(curSymbol(c))} ${esc(c)} — ${esc(CURRENCIES[c]?.name || c)}</option>`).join('');
  return `
    <header class="top">
      <div class="brand"><span class="logo">${mascot(64)}</span>Cats love fish</div>
      <div class="top-actions">
        <label class="chip" title="Валюта">
          <span class="num">${esc(curSymbol(cur))} ${esc(cur)}</span>${CARET}
          <select id="cur" aria-label="Валюта отображения">${opts}</select>
        </label>
        <a class="icon-btn" href="#settings" aria-label="Настройки">${GEAR}</a>
      </div>
    </header>`;
}

function hero(s, prev, cur, monthIdx) {
  const rest = s.income - s.expense;
  let cmp = '';
  if (prev.expense > 0 && s.expense > 0) {
    const pct = Math.round((s.expense / prev.expense - 1) * 100);
    if (pct === 0) cmp = 'столько же, сколько за те же дни прошлого месяца';
    else cmp = `на <b>${Math.abs(pct)}%</b> ${pct < 0 ? 'меньше' : 'больше'}, чем за те же дни прошлого месяца`;
  } else if (s.expense === 0) {
    cmp = 'в этом месяце трат пока нет';
  }
  return `
    <section class="card hero">
      ${sparkle(30, '#A775C9', 'top:14px;right:18px')}${sparkle(14, '#D480BB', 'top:10px;right:58px')}${sparkle(11, '#DEAFC2', 'top:46px;right:14px')}
      <div class="hero-label">Потрачено в ${MONTHS_PREP[monthIdx]}</div>
      <div class="hero-sum num">${money(s.expense, cur)}</div>
      <div class="hero-cmp">${cmp}</div>
      <div class="hero-row">
        <div class="hero-stat">
          <div class="k"><span class="dot" style="background:var(--income-fill)"></span>Доходы</div>
          <div class="v num">${money(s.income, cur)}</div>
        </div>
        <div class="hero-stat">
          <div class="k">Остаток</div>
          <div class="v num${rest > 0 ? ' pos' : ''}">${money(rest, cur)}</div>
        </div>
      </div>
    </section>`;
}

function categoriesCard(s, cur) {
  if (!s.expenseTop.length) {
    return `
      <section class="card">
        <div class="card-head"><h2>Категории</h2></div>
        <div class="empty">Здесь появятся траты по категориям</div>
      </section>`;
  }
  let rows = s.expenseTop.slice(0, TOP_N).map(x => ({ ...x, c: cat(x.cat) }));
  const restList = s.expenseTop.slice(TOP_N);
  if (restList.length) {
    const sum = restList.reduce((a, x) => a + x.sum, 0);
    rows.push({ sum, share: sum / s.expense, c: { name: `Остальное (${restList.length})`, icon: '…', color: '#C9B5D6' } });
  }
  const stack = rows.map(r => `<span style="flex:${Math.max(r.share, 0.005)};background:${r.c.color}"></span>`).join('');
  const maxShare = rows.reduce((m, r) => Math.max(m, r.share), 0) || 1;
  const list = rows.map(r => `
    <div class="cat-row">
      <span class="ico" style="--c:${r.c.color};background:${r.c.color}55">${iconHtml(r.c.icon)}</span>
      <div class="cat-main">
        <div class="cat-name"><span>${esc(r.c.name)}</span><span class="share num">${pct(r.share)}</span></div>
        <div class="bar"><span style="width:${(r.share / maxShare) * 100}%;background:${r.c.color}"></span></div>
      </div>
      <div class="cat-sum num">${money(r.sum, cur)}</div>
    </div>`).join('');
  return `
    <section class="card">
      <div class="card-head"><h2>Категории</h2><a class="link" href="#ops">Все</a></div>
      ${rows.length > 1 ? `<div class="stack" role="img" aria-label="Доли категорий">${stack}</div>` : ""}
      ${list}
    </section>`;
}

function recentCard(list, cur, total) {
  if (!list.length) {
    return `
      <section class="card">
        <div class="card-head"><h2>Последние операции</h2></div>
        <div class="empty">
          <span class="big">${mascot(220, 'c')}</span>
          Пока пусто. Добавьте первую покупку или отсканируйте чек.
          <br><a class="btn" href="#add">Добавить</a>
        </div>
      </section>`;
  }
  const rows = list.map(o => {
    const c = cat(o.cat);
    const title = o.store || o.note || c.name;
    const sub = [shortDay(o.date), title !== c.name ? c.name : null, o.items?.length ? `${o.items.length} поз.` : null].filter(Boolean).join(' · ');
    const inc = o.type === 'income';
    return `
      <a class="op-row" href="#ops/${encodeURIComponent(o.id)}">
        <span class="ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span>
        <div style="min-width:0">
          <div class="op-title">${esc(title)}</div>
          <div class="op-sub">${esc(sub)}</div>
        </div>
        <div class="op-sum num${inc ? ' pos' : ''}">${money(inc ? o.amount : -o.amount, cur, { sign: inc })}</div>
      </a>`;
  }).join('');
  return `
    <section class="card">
      <div class="card-head"><h2>Последние операции</h2>${total > list.length ? '<a class="link" href="#ops">Все</a>' : ''}</div>
      ${rows}
    </section>`;
}

function shortDay(iso) {
  const t = todayISO();
  if (iso === t) return 'Сегодня';
  if (iso === isoDate(new Date(Date.now() - 864e5))) return 'Вчера';
  return fmtDate(iso);
}

function pct(share) {
  const p = share * 100;
  if (p > 0 && p < 1) return '<1%';
  return Math.round(p) + '%';
}
