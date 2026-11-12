// Настройки (#settings): валюты, категории (имя, значок, цвет), резервная копия JSON.
import { iconHtml } from '../icons.js';
import { warmOcrCache } from '../ocr.js';
import { createFamily, joinFamily, leaveFamily, syncNow, onStatus } from '../sync.js';
import { state, allOps, setSetting, saveCat, exportAll, importAll, checkBackup } from '../store.js';
import { PALETTE, EMOJI_CHOICES } from '../categories.js';
import { esc, CURRENCIES, curSymbol, todayISO, fmtDate } from '../util.js';

const BACK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>`;

export async function render(el) {
  const used = new Set((await allOps(null)).map(o => o.currency));
  const S = {
    catTab: 'expense',
    edit: null,          // редактируемая категория: объект (новая — без id)
    pending: null,       // файл копии, ждущий решения: { data, info }
    fam: null,           // форма семьи: 'create' | 'join'
    ff: { code: '', phrase: '' },
    famMsg: '', famBusy: false, showCode: false, confirmLeave: false,
    confirmReplace: false,
    msg: '',
  };

  function draw() {
    el.innerHTML = `
      <header class="top">
        <a class="icon-btn" href="#home" aria-label="Назад">${BACK}</a>
        <h1 class="page-title">Настройки</h1>
        <span style="width:36px"></span>
      </header>
      ${currenciesCard()}
      ${categoriesCard()}
      ${familyCard()}
      ${offlineCard()}
      ${backupCard()}
      ${S.edit ? catSheet() : ''}`;
    bindStatus();
  }

  // ---------- валюты ----------
  function currenciesCard() {
    const cur = state.settings.currency;
    const rows = state.settings.currencies.map(c => {
      const locked = c === cur || used.has(c);
      return `
        <div class="set-row">
          <span class="set-sym">${esc(curSymbol(c))}</span>
          <div class="set-main"><div>${esc(c)} — ${esc(CURRENCIES[c]?.name || c)}</div>
            ${c === cur ? '<div class="op-sub">Сейчас на экранах</div>' : used.has(c) ? '<div class="op-sub">Есть операции</div>' : ''}</div>
          ${locked ? '' : `<button type="button" class="it-del" data-rmcur="${esc(c)}" aria-label="Убрать валюту">✕</button>`}
        </div>`;
    }).join('');
    const free = Object.keys(CURRENCIES).filter(c => !state.settings.currencies.includes(c));
    const opts = free.map(c => `<option value="${c}">${esc(curSymbol(c))} ${c} — ${esc(CURRENCIES[c].name)}</option>`).join('');
    return `
      <section class="card">
        <div class="card-head"><h2>Валюты</h2></div>
        <p class="set-hint">Каждая операция хранится в своей валюте, пересчёта нет. Здесь список валют для переключателя.</p>
        ${rows}
        ${free.length ? `<select id="addcur" class="set-select"><option value="">+ Добавить валюту…</option>${opts}</select>` : ''}
      </section>`;
  }

  // ---------- категории ----------
  function categoriesCard() {
    const inc = S.catTab === 'income';
    const type = inc ? 'income' : 'expense';
    const tops = state.cats.filter(c => !c.parent && c.type === type);
    const rowHtml = (c, sub) => `
      <button type="button" class="set-row tap${sub ? ' sub' : ''}${c.hidden ? ' off' : ''}" data-editcat="${esc(c.id)}">
        <span class="ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span>
        <div class="set-main"><div>${esc(c.name)}</div>${c.hidden ? '<div class="op-sub">Скрыта</div>' : ''}</div>
        <span class="chev" aria-hidden="true">›</span>
      </button>`;
    const rows = tops.map(t => rowHtml(t, false) + state.cats.filter(s => s.parent === t.id).map(s => rowHtml(s, true)).join('')).join('');
    return `
      <section class="card">
        <div class="card-head"><h2>Категории</h2>
          <div class="seg seg-sm" role="group">
            <button type="button" class="${inc ? '' : 'on'}" data-cattab="expense">Расходы</button>
            <button type="button" class="${inc ? 'on' : ''}" data-cattab="income">Доходы</button>
          </div></div>
        ${rows}
        <button type="button" class="btn btn-ghost btn-wide set-add" data-newcat="1">+ Новая категория</button>
      </section>`;
  }

  function catSheet() {
    const c = S.edit;
    const isNew = !c.id;
    const emojis = [...new Set(EMOJI_CHOICES)].map(e => `<button type="button" class="pick-e${e === c.icon ? ' on' : ''}" data-icon="${e}">${e}</button>`).join('');
    const colors = PALETTE.map(h => `<button type="button" class="pick-c${h === c.color ? ' on' : ''}" data-color="${h}" style="background:${h}" aria-label="Цвет ${h}"></button>`).join('');
    const parents = c.type === 'expense' && (isNew || c.parent)
      ? `<label class="field"><span>Где лежит</span>
          <select data-cf="parent">
            <option value=""${!c.parent ? ' selected' : ''}>Основная категория</option>
            <option value="food"${c.parent === 'food' ? ' selected' : ''}>Подкатегория «Продуктов»</option>
          </select></label>` : '';
    return `
      <div class="sheet-wrap">
        <div class="scrim" data-sclose></div>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Категория">
          <div class="sheet-grab"></div>
          <h2 class="sheet-title">${isNew ? 'Новая категория' : 'Категория'}</h2>
          <div class="form">
            <div class="cat-preview"><span class="ico big-ico" style="--c:${c.color};background:${c.color}55">${iconHtml(c.icon)}</span></div>
            <label class="field"><span>Название</span><input type="text" data-cf="name" value="${esc(c.name)}" maxlength="40" placeholder="Например, Спорт"></label>
            ${parents}
            <div class="field"><span>Значок</span><div class="emoji-grid">${emojis}</div></div>
            <div class="field"><span>Цвет</span><div class="color-grid">${colors}</div></div>
            ${!isNew ? `<button type="button" class="btn btn-ghost" data-hide="1">${c.hidden ? 'Показать категорию' : 'Скрыть категорию'}</button>
              <p class="set-hint">Скрытая категория пропадает из выбора, но старые операции в ней остаются.</p>` : ''}
            <div class="form-err" id="cerr" hidden></div>
            <div class="sheet-actions"><button type="button" class="btn" data-csave="1">Сохранить</button>
              <button type="button" class="btn btn-ghost" data-sclose>Отмена</button></div>
          </div>
        </div>
      </div>`;
  }

  // ---------- семья (общий доступ) ----------
  function familyCard() {
    const cfg = state.settings.sync;
    const intro = `<p class="set-hint">Общие траты на двух телефонах. Всё шифруется на устройстве семейной фразой: сервер видит только шифр и не может прочитать записи. Без сети работает как обычно, обмен случится позже.</p>`;
    if (cfg) {
      const code = S.showCode ? `
        <div class="set-note">Отправьте второму человеку код и фразу <b>разными сообщениями</b>.<br><br>
        Код семьи:<br><code class="fam-code">${esc(cfg.familyId)}</code><br><br>
        Фраза:<br><code class="fam-code">${esc(cfg.phrase)}</code></div>` : '';
      const leave = S.confirmLeave
        ? `<p class="set-hint bad">Вы выйдете из семьи: на этом телефоне останутся все записи, но обмен прекратится. Вернуться можно по коду и фразе.</p>
           <div class="sheet-actions"><button type="button" class="btn btn-danger" data-fam="leave-yes">Выйти</button><button type="button" class="btn btn-ghost" data-fam="leave-no">Отмена</button></div>`
        : `<button type="button" class="btn btn-ghost btn-wide set-add" data-fam="leave">Выйти из семьи</button>`;
      return `
        <section class="card">
          <div class="card-head"><h2>Семья</h2></div>
          ${intro}
          <div class="set-note" id="fam-status">Проверяю связь…</div>
          ${code}
          <button type="button" class="btn btn-wide" data-fam="sync">Синхронизировать сейчас</button>
          <button type="button" class="btn btn-ghost btn-wide set-add" data-fam="code">${S.showCode ? 'Скрыть код и фразу' : 'Показать код и фразу'}</button>
          ${leave}
        </section>`;
    }
    const msg = S.famMsg ? `<div class="form-err">${esc(S.famMsg)}</div>` : '';
    let form = '';
    if (S.fam === 'create') {
      form = `
        <label class="field"><span>Придумайте семейную фразу (от 8 символов)</span>
          <input type="text" data-ff="phrase" value="${esc(S.ff.phrase)}" placeholder="Например, рыбки любят котиков" autocomplete="off"></label>
        <p class="set-hint">Фразу знают только вы двое. Если её потерять, расшифровать данные из облака нельзя.</p>
        ${msg}
        <button type="button" class="btn btn-wide" data-fam="create-go"${S.famBusy ? ' disabled' : ''}>${S.famBusy ? 'Подождите…' : 'Создать семью'}</button>`;
    } else if (S.fam === 'join') {
      form = `
        <label class="field"><span>Код семьи</span>
          <input type="text" data-ff="code" value="${esc(S.ff.code)}" placeholder="32 символа" autocomplete="off" autocapitalize="off"></label>
        <label class="field"><span>Семейная фраза</span>
          <input type="text" data-ff="phrase" value="${esc(S.ff.phrase)}" autocomplete="off"></label>
        ${msg}
        <button type="button" class="btn btn-wide" data-fam="join-go"${S.famBusy ? ' disabled' : ''}>${S.famBusy ? 'Подождите…' : 'Войти в семью'}</button>`;
    }
    return `
      <section class="card">
        <div class="card-head"><h2>Семья</h2></div>
        ${intro}
        <div class="seg" role="group">
          <button type="button" class="${S.fam === 'create' ? 'on' : ''}" data-fam="create">Создать семью</button>
          <button type="button" class="${S.fam === 'join' ? 'on' : ''}" data-fam="join">Войти в семью</button>
        </div>
        <div class="fam-form">${form}</div>
      </section>`;
  }

  let offStatus = null;
  function bindStatus() {
    if (offStatus) offStatus();
    offStatus = onStatus(st => {
      const n = el.querySelector('#fam-status');
      if (!n || !el.isConnected) return;
      const label = { off: 'Не подключено', connecting: 'Подключаюсь…', ok: 'Подключено: изменения обмениваются автоматически.', offline: st.text || 'Нет сети.', error: st.text || 'Ошибка.' }[st.state];
      n.textContent = label;
      n.classList.toggle('bad', st.state === 'error');
    });
  }

  async function famAction(a) {
    if (a === 'create' || a === 'join') { S.fam = a; S.famMsg = ''; draw(); return; }
    if (a === 'code') { S.showCode = !S.showCode; draw(); return; }
    if (a === 'sync') { await syncNow(); return; }
    if (a === 'leave') { S.confirmLeave = true; draw(); return; }
    if (a === 'leave-no') { S.confirmLeave = false; draw(); return; }
    if (a === 'leave-yes') { S.confirmLeave = false; S.showCode = false; await leaveFamily(); return; }
    if (a === 'create-go' || a === 'join-go') {
      S.famBusy = true; S.famMsg = ''; draw();
      try {
        if (a === 'create-go') await createFamily(S.ff.phrase);
        else await joinFamily(S.ff.code, S.ff.phrase);
        S.famBusy = false; S.fam = null; S.ff = { code: '', phrase: '' }; S.showCode = a === 'create-go';
        draw();
      } catch (e) {
        S.famBusy = false;
        S.famMsg = e.message || String(e);
        draw();
      }
    }
  }

  // ---------- работа без интернета ----------
  function offlineCard() {
    return `
      <section class="card">
        <div class="card-head"><h2>Работа без интернета</h2></div>
        <p class="set-hint">Само приложение работает офлайн сразу. Чтобы читать чеки без сети, один раз скачайте движок распознавания и словари (около 15 МБ). Лучше по Wi-Fi.</p>
        <button type="button" class="btn btn-ghost btn-wide" id="warm">Подготовить для работы без интернета</button>
        <div class="set-note" id="warm-msg" hidden></div>
      </section>`;
  }

  async function doWarm(btn) {
    const msg = el.querySelector('#warm-msg');
    btn.disabled = true;
    msg.hidden = false;
    msg.textContent = 'Скачиваю…';
    try {
      await warmOcrCache(['rus', 'est'], name => { msg.textContent = 'Готовлю: ' + name + '…'; });
      for (const f of ['pdfjs/pdf.min.js', 'pdfjs/pdf.worker.min.js']) {
        await fetch(new URL('../../vendor/' + f, import.meta.url));
      }
      msg.textContent = 'Готово: чеки можно читать без интернета.';
    } catch (e) {
      msg.textContent = 'Не получилось: ' + (e.message || e) + '. Проверьте сеть и попробуйте ещё раз.';
    }
    btn.disabled = false;
  }

  // ---------- резервная копия ----------
  function backupCard() {
    const last = state.settings.lastBackup;
    let body = '';
    if (S.pending) {
      const i = S.pending.info;
      body = `
        <div class="set-note">В файле: операций ${i.ops}, категорий ${i.cats}${i.date ? ', сохранён ' + esc(fmtDate(i.date.slice(0, 10), true)) : ''}.</div>
        ${S.confirmReplace
          ? `<p class="set-hint bad">Всё, что сейчас в приложении, будет заменено данными из файла. Вернуть будет нельзя.</p>
             <div class="sheet-actions"><button type="button" class="btn btn-danger" data-imp="replace">Да, заменить</button>
             <button type="button" class="btn btn-ghost" data-imp="cancel">Отмена</button></div>`
          : `<div class="sheet-actions"><button type="button" class="btn" data-imp="merge">Объединить</button>
             <button type="button" class="btn btn-ghost" data-imp="ask">Заменить всё</button></div>
             <p class="set-hint">«Объединить» ничего не стирает: из двух версий записи берётся более новая.</p>
             <button type="button" class="link link-btn" data-imp="cancel">Отмена</button>`}`;
    } else {
      body = `
        <button type="button" class="btn btn-wide" id="export">Сохранить копию</button>
        <label class="btn btn-ghost btn-wide set-add">Загрузить копию из файла
          <input type="file" id="impfile" accept=".json,application/json" hidden></label>`;
    }
    return `
      <section class="card">
        <div class="card-head"><h2>Резервная копия</h2></div>
        <p class="set-hint">${last ? 'Последняя копия: ' + esc(fmtDate(last, true)) + '.' : 'Копий ещё не было.'}
          Данные живут только в этом телефоне. Если удалить иконку с экрана «Домой», они пропадут, поэтому сохраняйте копию в «Файлы» или iCloud.</p>
        ${S.msg ? `<div class="set-note">${esc(S.msg)}</div>` : ''}
        ${body}
      </section>`;
  }

  async function doExport() {
    const data = await exportAll();
    const name = `morkovka-${todayISO()}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: name });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;   // пользователь закрыл окно «Поделиться»
      S.msg = 'Не удалось сохранить копию: ' + e.message; draw(); return;
    }
    await setSetting('lastBackup', todayISO());   // перерисует экран
  }

  // ---------- события ----------
  el.addEventListener('input', e => {
    const ff = e.target.dataset.ff;
    if (ff) { S.ff[ff] = e.target.value; return; }
    const f = e.target.dataset.cf;
    if (f && S.edit) S.edit[f] = e.target.value;
  });

  el.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'addcur' && t.value) {
      await setSetting('currencies', [...state.settings.currencies, t.value]);
    } else if (t.dataset.cf === 'parent' && S.edit) {
      S.edit.parent = t.value || null;
    } else if (t.id === 'impfile' && t.files[0]) {
      try {
        const data = JSON.parse(await t.files[0].text());
        S.pending = { data, info: checkBackup(data) };
        S.confirmReplace = false; S.msg = '';
      } catch (err) {
        S.msg = err instanceof SyntaxError ? 'Файл повреждён или это не копия Морковки.' : err.message;
      }
      draw();
    }
  });

  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.fam) { await famAction(d.fam); return; }
    if (d.rmcur) await setSetting('currencies', state.settings.currencies.filter(c => c !== d.rmcur));
    else if (d.cattab) { S.catTab = d.cattab; draw(); }
    else if (d.editcat) { S.edit = { ...state.catMap.get(d.editcat) }; draw(); }
    else if (d.newcat) {
      const type = S.catTab;
      S.edit = { name: '', icon: '⭐', color: PALETTE[state.cats.length % PALETTE.length], parent: null, type };
      draw();
      el.querySelector('[data-cf=name]')?.focus();
    }
    else if (d.sclose !== undefined) { S.edit = null; draw(); }
    else if (d.icon) { S.edit.icon = d.icon; refreshPick(); }
    else if (d.color) { S.edit.color = d.color; refreshPick(); }
    else if (d.hide) { S.edit.hidden = !S.edit.hidden; await saveEdit(); }
    else if (d.csave) await saveEdit();
    else if (b.id === 'export') await doExport();
    else if (b.id === 'warm') await doWarm(b);
    else if (d.imp) {
      if (d.imp === 'cancel') { S.pending = null; S.confirmReplace = false; draw(); }
      else if (d.imp === 'ask') { S.confirmReplace = true; draw(); }
      else {
        try {
          await importAll(S.pending.data, d.imp);
          location.reload();     // всё перечитать из базы
        } catch (err) { S.msg = 'Не удалось загрузить: ' + err.message; S.pending = null; draw(); }
      }
    }
  });

  function refreshPick() {
    const c = S.edit;
    el.querySelectorAll('[data-icon]').forEach(x => x.classList.toggle('on', x.dataset.icon === c.icon));
    el.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x.dataset.color === c.color));
    const p = el.querySelector('.cat-preview .ico');
    if (p) { p.innerHTML = iconHtml(c.icon); p.style.background = c.color + '55'; p.style.setProperty('--c', c.color); }
  }

  async function saveEdit() {
    const c = S.edit;
    const name = (c.name || '').trim();
    if (!name) {
      const n = el.querySelector('#cerr');
      if (n) { n.textContent = 'Введите название.'; n.hidden = false; }
      return;
    }
    S.edit = null;
    await saveCat({ ...c, name, parent: c.parent || null });   // перерисует экран
  }

  draw();
}
