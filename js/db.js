// Тонкая обёртка над IndexedDB. Все данные пользователя живут только здесь, на устройстве.
// Миграции только добавляют хранилища — обновление приложения никогда не стирает данные.

const DB_NAME = 'morkovka';
const DB_VERSION = 1;

let dbp = null;

export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB недоступна в этом браузере'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = req.result;
      // версия 1
      if (e.oldVersion < 1) {
        const ops = db.createObjectStore('ops', { keyPath: 'id' });
        ops.createIndex('date', 'date');
        db.createObjectStore('cats', { keyPath: 'id' });
        db.createObjectStore('dict', { keyPath: 'key' });
        db.createObjectStore('budgets', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // будущие версии: if (e.oldVersion < 2) { ... только добавлять ... }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('IndexedDB blocked');
  });
  return dbp;
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  }));
}

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  all: store => tx(store, 'readonly', s => reqP(s.getAll())),
  get: (store, key) => tx(store, 'readonly', s => reqP(s.get(key))),
  put: (store, obj) => tx(store, 'readwrite', s => { s.put(obj); }),
  del: (store, key) => tx(store, 'readwrite', s => { s.delete(key); }),
  clear: store => tx(store, 'readwrite', s => { s.clear(); }),
  bulkPut: (store, arr) => tx(store, 'readwrite', s => { for (const o of arr) s.put(o); }),
  range: (store, index, from, to) => tx(store, 'readonly', s => reqP(s.index(index).getAll(IDBKeyRange.bound(from, to)))),
  bulkDel: (store, keys) => tx(store, 'readwrite', s => { for (const k of keys) s.delete(k); }),
};

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* ignore */ }
  return false;
}
