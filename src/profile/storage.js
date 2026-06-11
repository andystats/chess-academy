// Local-first persistence with graceful degradation. Uses IndexedDB when available; if it's
// missing or blocked (private mode, disabled storage), falls back to an in-memory store so the
// app still runs — progress just won't survive a reload (the UI surfaces this).
//
// Two object stores: `profiles` (keyed by id) and `progress` (keyed by `${profileId}:${lessonId}`).
// dbSchemaVersion lives here, independent of the content schemaVersion.

const DB_NAME = 'chess-academy';
const DB_SCHEMA_VERSION = 1;

const progressKey = (profileId, lessonId) => `${profileId}:${lessonId}`;

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbStore(db) {
  const tx = (store, mode) => db.transaction(store, mode).objectStore(store);
  return {
    persistent: true,
    listProfiles: () => promisifyRequest(tx('profiles', 'readonly').getAll()),
    putProfile: (profile) => promisifyRequest(tx('profiles', 'readwrite').put(profile)),
    deleteProfile: (id) => promisifyRequest(tx('profiles', 'readwrite').delete(id)),
    getProgress: (profileId, lessonId) =>
      promisifyRequest(tx('progress', 'readonly').get(progressKey(profileId, lessonId))),
    putProgress: (profileId, lessonId, value) =>
      promisifyRequest(tx('progress', 'readwrite').put(value, progressKey(profileId, lessonId))),
    async listProgress(profileId) {
      const store = tx('progress', 'readonly');
      const keys = await promisifyRequest(store.getAllKeys());
      const values = await promisifyRequest(store.getAll());
      const prefix = `${profileId}:`;
      const out = Object.create(null); // a '__proto__' lesson key must not pollute the prototype
      keys.forEach((key, i) => {
        if (String(key).startsWith(prefix)) out[String(key).slice(prefix.length)] = values[i];
      });
      return out;
    },
  };
}

function memoryStore() {
  const profiles = new Map();
  const progress = new Map();
  return {
    persistent: false,
    listProfiles: async () => [...profiles.values()],
    putProfile: async (profile) => void profiles.set(profile.id, profile),
    deleteProfile: async (id) => void profiles.delete(id),
    getProgress: async (profileId, lessonId) => progress.get(progressKey(profileId, lessonId)),
    putProgress: async (profileId, lessonId, value) => void progress.set(progressKey(profileId, lessonId), value),
    async listProgress(profileId) {
      const prefix = `${profileId}:`;
      const out = Object.create(null);
      for (const [key, value] of progress) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
      }
      return out;
    },
  };
}

/** Open the best available store. Always resolves (never rejects); check `.persistent`. */
export async function createStore() {
  try {
    const db = await openIndexedDb();
    // Best-effort: ask the browser not to evict our data under storage pressure.
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    return idbStore(db);
  } catch {
    return memoryStore();
  }
}
