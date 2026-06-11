// Crypto-quality random ids with a guarded fallback: crypto.randomUUID exists only in secure
// contexts (HTTPS / localhost), so a plain-HTTP LAN deployment must not crash generating an id.

/** A UUID where available, else a comfortably-unique random token. */
export function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
