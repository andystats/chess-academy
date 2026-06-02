// Synchronous localStorage helpers for the online arena. This mirrors the graceful-degradation
// philosophy of src/profile/storage.js (never throw — storage may be disabled in private mode) but
// deliberately NOT its async IndexedDB API: here we need tiny synchronous reads/writes keyed by game
// id, on the hot path of every move.
//
// Three things live here:
//   - selfId():        a stable per-browser id, so reconnects keep the same identity (used to lock the
//                      two player slots and ignore stray third parties).
//   - host config:     the creator's chosen variant + color, so a reload knows it is still the host.
//   - latest snapshot: the authoritative game state, persisted before each broadcast, so the host can
//                      resume after a reload. Both peers persist it so a Resync can be answered.

const NS = 'chess-academy:online';
const SELF_ID_KEY = `${NS}:self-id`;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / disabled) — degrade silently */
  }
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Stable per-browser id, created on first use and reused thereafter. */
export function selfId() {
  let id = read(SELF_ID_KEY);
  if (!id) {
    id = randomId();
    write(SELF_ID_KEY, id);
  }
  return id;
}

/** Random 16-char game id for an invite link (URL-safe). */
export function newGameId() {
  return randomId().replace(/-/g, '').slice(0, 16);
}

const hostKey = (gameId) => `${NS}:${gameId}:host`;
const snapKey = (gameId) => `${NS}:${gameId}:snap`;

/** Remember that this browser created `gameId` (so a reload resumes as the host). */
export function saveHostConfig(gameId, config) {
  write(hostKey(gameId), JSON.stringify(config));
}

/** The host config for `gameId`, or null if this browser did not create it. */
export function loadHostConfig(gameId) {
  const raw = read(hostKey(gameId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Persist the latest authoritative snapshot for `gameId` (call before broadcasting it). */
export function saveSnapshot(gameId, snapshot) {
  write(snapKey(gameId), JSON.stringify(snapshot));
}

/** The last persisted snapshot for `gameId`, or null. */
export function loadSnapshot(gameId) {
  const raw = read(snapKey(gameId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
