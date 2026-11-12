// Запуск приложения и переключение вкладок по адресу: #home, #ops, #add, #settings.
// Адрес может нести параметр после «/»: #ops/<id операции>.
import { initStore, onChange } from './store.js';
import { $, $$, esc } from './util.js';
import * as home from './views/home.js';
import * as ops from './views/ops.js';
import * as add from './views/add.js';
import * as settings from './views/settings.js';
import { grainUrl } from './grain.js';
import { startSync } from './sync.js';

const ROUTES = { home, ops, add, settings };
const TAB_OF = { home: 'home', ops: 'ops', add: 'add', settings: 'home' };

let renderToken = 0;
let lastRoute = '';

function parseHash() {
  const [name, ...rest] = location.hash.replace(/^#/, '').split('/');
  return { name: ROUTES[name] ? name : 'home', param: rest.join('/') || null };
}

// keepScroll: перерисовка того же экрана после изменения данных — не прыгаем наверх.
async function show({ keepScroll = false } = {}) {
  const { name, param } = parseHash();
  const token = ++renderToken;
  $$('.tab').forEach(t => {
    const on = t.dataset.tab === TAB_OF[name];
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });

  const el = document.createElement('div');
  el.className = 'view view-' + name;
  try {
    await ROUTES[name].render(el, { param });
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="err">Не получилось открыть экран.<br><small>${esc(e.message)}</small></div>`;
  }
  if (token !== renderToken) return; // пока рисовали, пользователь ушёл на другой экран

  const route = name + '/' + (param || '');
  const y = window.scrollY;
  $('#view').replaceChildren(el);
  window.scrollTo(0, keepScroll && route === lastRoute ? y : 0);
  lastRoute = route;
}

async function boot() {
  try {
    await initStore();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="err">Не удалось открыть хранилище данных.<br>
      <small>${esc(e.message)}</small><br><br>Если Safari в режиме «Частный доступ», откройте приложение в обычном.</div>`;
    return;
  }
  window.addEventListener('hashchange', () => show());
  // Чужие изменения из семьи не должны стирать то, что человек сейчас вводит: на «Добавить» и в настройках не перерисовываем.
  onChange(what => {
    if (what === 'remote' && ['add', 'settings'].includes(parseHash().name)) return;
    show({ keepScroll: true });
  });
  // повторное нажатие на активную вкладку — наверх
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    if (location.hash === t.getAttribute('href')) window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  await show();
  startSync();
  // фон с напылением рисуем после первого экрана, чтобы не задерживать запуск
  grainUrl().then(u => { const bg = $('#bg'); if (bg) bg.style.backgroundImage = `url(${u})`; }).catch(e => console.warn(e));
}

boot();

// Офлайн-режим. На локальном сервере (разработка) не включаем, чтобы кэш не прятал правки; для проверки: ?sw=1
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw=1'))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
}
