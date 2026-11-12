// Общий доступ (семья): Firebase Firestore + сквозное шифрование.
// На сервер уходит только шифр: каждая запись (операция, категория, слово словаря) шифруется AES-256-GCM
// ключом, выведенным из семейной фразы (PBKDF2, 600 000 кругов, соль — код семьи). Фраза и ключ лежат только на телефонах.
// Конфликты: побеждает запись с большим updatedAt. Удаление — запись-«могильный камень» (deleted: true).
import { firebaseConfig } from './firebase-config.js';
import { state, setSetting, setQuiet, onWrite, localSince, applyRemote, remoteApplied } from './store.js';

const VENDOR = new URL('../vendor/firebase/', import.meta.url).href;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- статус ----------
let status = { state: 'off', text: '' };   // off | connecting | ok | offline | error
const statusListeners = new Set();
export const getStatus = () => status;
export function onStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}
function setStatus(st, text = '') {
  status = { state: st, text };
  for (const fn of statusListeners) { try { fn(status); } catch (e) { console.error(e); } }
}

// ---------- шифрование ----------
const b64 = buf => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');

async function deriveKeyBytes(phrase, familyId) {
  const base = await crypto.subtle.importKey('raw', enc.encode(phrase.normalize('NFKC').trim()), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(familyId), iterations: 600000 }, base, 256);
  return new Uint8Array(bits);
}
const importKey = bytes => crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);

async function encrypt(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decrypt(key, d) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, key, unb64(d.ct));
  return JSON.parse(dec.decode(pt));
}
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 32);

// ---------- Firebase ----------
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.dataset.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не удалось загрузить ' + src));
    document.head.appendChild(s);
  });
}

let fbReady = null;
function loadFirebase() {
  if (!fbReady) {
    fbReady = (async () => {
      for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(VENDOR + f);
      const fb = window.firebase;
      if (!fb.apps.length) fb.initializeApp(firebaseConfig);
      return fb;
    })().catch(e => { fbReady = null; throw e; });
  }
  return fbReady;
}

let key = null;          // CryptoKey семьи
let col = null;          // коллекция families/{id}/docs
let unsub = null;
let queue = Promise.resolve();
let pushing = false;
let timer = null;

function explain(e) {
  const c = e && e.code || '';
  if (c === 'auth/operation-not-allowed') return 'В Firebase выключен анонимный вход.';
  if (c.includes('permission-denied')) return 'Сервер не пустил: проверьте правила Firestore.';
  if (c.includes('unavailable') || c.includes('network') || !navigator.onLine) return 'Нет связи с сервером. Повторим, когда появится сеть.';
  return (e && e.message) || String(e);
}

async function open(cfg) {
  const fb = await loadFirebase();
  await fb.auth().signInAnonymously();
  key = await importKey(unb64(cfg.keyB64));
  col = fb.firestore().collection('families').doc(cfg.familyId).collection('docs');
  return fb;
}

// ---------- отправка ----------
async function push() {
  if (!col || pushing) return;
  pushing = true;
  try {
    const fb = window.firebase;
    const since = state.settings.syncPushed || 0;
    const { ops, cats, dict } = await localSince(since);
    const items = [
      ...ops.map(r => ['o_' + r.id, r]),
      ...cats.map(r => ['c_' + r.id, r]),
      ...await Promise.all(dict.map(async r => ['d_' + await sha(r.key), r])),
    ];
    let max = since;
    for (let i = 0; i < items.length; i += 400) {
      const batch = fb.firestore().batch();
      for (const [id, rec] of items.slice(i, i + 400)) {
        batch.set(col.doc(id), { ...await encrypt(key, rec), updatedAt: rec.updatedAt || 0 });
        max = Math.max(max, rec.updatedAt || 0);
      }
      await batch.commit();
    }
    if (max > since) await setQuiet('syncPushed', max);
  } finally {
    pushing = false;
  }
}

function schedulePush() {
  if (!col) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    push().catch(e => setStatus(navigator.onLine ? 'error' : 'offline', explain(e)));
  }, 1500);
}

// ---------- приём ----------
async function handle(snap) {
  let changed = false, fails = 0;
  let max = state.settings.syncPulled || 0;
  for (const ch of snap.docChanges()) {
    if (ch.type === 'removed' || ch.doc.id === 'check') continue;
    const d = ch.doc.data();
    const kind = { o: 'op', c: 'cat', d: 'dict' }[ch.doc.id[0]];
    if (!kind) continue;
    try {
      const rec = await decrypt(key, d);
      if (await applyRemote(kind, rec)) changed = true;
      max = Math.max(max, d.updatedAt || 0);
    } catch (e) {
      fails++;
    }
  }
  if (max > (state.settings.syncPulled || 0)) await setQuiet('syncPulled', max);
  if (fails) setStatus('error', 'Часть записей не удалось расшифровать. Проверьте семейную фразу.');
  else if (status.state !== 'ok') setStatus('ok');
  if (changed) remoteApplied();
}

function listen() {
  if (unsub) unsub();
  unsub = col.where('updatedAt', '>', state.settings.syncPulled || 0).onSnapshot(
    snap => { queue = queue.then(() => handle(snap)).catch(e => console.error(e)); },
    err => setStatus(navigator.onLine ? 'error' : 'offline', explain(err)),
  );
}

// ---------- управление ----------
export async function startSync() {
  const cfg = state.settings.sync;
  if (!cfg) { setStatus('off'); return; }
  if (!navigator.onLine) { setStatus('offline', 'Нет сети. Изменения отправятся, когда она появится.'); return; }
  setStatus('connecting');
  try {
    await open(cfg);
    await push();
    listen();
    setStatus('ok');
  } catch (e) {
    console.warn('sync', e);
    setStatus(navigator.onLine ? 'error' : 'offline', explain(e));
  }
}

export async function syncNow() {
  if (!col) return startSync();
  try {
    await push();
    setStatus('ok');
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline', explain(e));
  }
}

const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));

// Создать новую семью: код — случайный (128 бит), фразу придумывает пользователь.
export async function createFamily(phrase) {
  phrase = phrase.trim();
  if (phrase.length < 8) throw new Error('Фраза слишком короткая: нужно хотя бы 8 символов.');
  const familyId = randomHex(16);
  const keyB64 = b64(await deriveKeyBytes(phrase, familyId));
  const cfg = { familyId, phrase, keyB64 };
  try {
    await open(cfg);
    await col.doc('check').set({ ...await encrypt(key, { ok: 1 }), updatedAt: 0 });
  } catch (e) {
    if (!state.settings.sync) { key = null; col = null; }
    throw e;
  }
  await setQuiet('syncPushed', 0);
  await setQuiet('syncPulled', 0);
  await setSetting('sync', cfg);
  await startSync();
  return cfg;
}

// Войти в существующую семью по коду и фразе.
export async function joinFamily(familyId, phrase) {
  familyId = familyId.trim().toLowerCase();
  phrase = phrase.trim();
  if (!/^[0-9a-f]{32}$/.test(familyId)) throw new Error('Код семьи — 32 символа из цифр и букв a–f.');
  if (!phrase) throw new Error('Введите семейную фразу.');
  const keyB64 = b64(await deriveKeyBytes(phrase, familyId));
  const cfg = { familyId, phrase, keyB64 };
  try {
    await open(cfg);
    const snap = await col.doc('check').get();
    if (!snap.exists) throw new Error('Семья с таким кодом не найдена. Проверьте код.');
    try { await decrypt(key, snap.data()); } catch (e) { throw new Error('Неверная фраза.'); }
  } catch (e) {
    if (!state.settings.sync) { key = null; col = null; }
    throw e;
  }
  await setQuiet('syncPushed', 0);
  await setQuiet('syncPulled', 0);
  await setSetting('sync', cfg);
  await startSync();
  return cfg;
}

// Выйти: данные на телефоне остаются, связь с семьёй прекращается.
export async function leaveFamily() {
  if (unsub) unsub();
  unsub = null; col = null; key = null;
  await setQuiet('syncPushed', undefined);
  await setQuiet('syncPulled', undefined);
  await setQuiet('sync', undefined);
  setStatus('off');
  await setSetting('currency', state.settings.currency);   // перерисовать экран
}

// Автозапуск и реакция на сеть.
onWrite(schedulePush);
window.addEventListener('online', () => { if (state.settings.sync) startSync(); });
window.addEventListener('offline', () => { if (state.settings.sync) setStatus('offline', 'Нет сети. Изменения отправятся, когда она появится.'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.settings.sync && col) schedulePush(); });
