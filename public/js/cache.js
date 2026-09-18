// Cache-first read helper for on-chain data.
//
// Every payload is stored under a contract-scoped key by the caller
// (board:<address>, dashboard:<address>:wallet). When the Setup address
// changes, cacheClearAll() drops every entry so the next page cannot paint
// bounties that belonged to the previous contract.
const NS = "patchcourt.cache.";
const FRESH_MS = 20000;

export function cacheGet(key, { allowStale = true } = {}) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.ts !== "number") return null;
    parsed.stale = Date.now() - parsed.ts > FRESH_MS;
    if (parsed.stale && !allowStale) return null;
    return parsed; // { value, ts, stale }
  } catch {
    return null;
  }
}

export function cacheSet(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify({ value, ts: Date.now() }));
  } catch {
    /* storage full or unavailable -- fresh data still renders */
  }
}

export function cacheRemove(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch {
    /* ignore */
  }
}

export function cacheClearAll() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(NS) || key === "patchcourt.bountyIds" || key.startsWith("patchcourt.bountyIds.")) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function sameJSON(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function formatAge(ts) {
  if (!ts) return "";
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
