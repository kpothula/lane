const PAGE_LIMIT = 1000;

export const EMPTY_COUNTS = { total: 0, pages: {} };

export function blockedTarget(hash) {
  const raw = String(hash ?? "");
  const value = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function pageKey(url) {
  const value = String(url ?? "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return value;
  }
}

export function normalizeCounts(value) {
  const pages = {};
  if (value?.pages && typeof value.pages === "object") {
    for (const [key, count] of Object.entries(value.pages)) {
      if (typeof key === "string" && Number.isInteger(count) && count > 0) pages[key] = count;
    }
  }
  const storedTotal = Number.isInteger(value?.total) && value.total > 0 ? value.total : 0;
  const pageTotal = Object.values(pages).reduce((sum, count) => sum + count, 0);
  return { total: Math.max(storedTotal, pageTotal), pages };
}

export function recordHit(counts, url) {
  const key = pageKey(url);
  const current = normalizeCounts(counts);
  if (!key) return current;
  const pages = { ...current.pages, [key]: (current.pages[key] || 0) + 1 };
  return { total: current.total + 1, pages: prune(pages) };
}

export function pageCount(counts, url) {
  const key = pageKey(url);
  if (!key) return 0;
  return normalizeCounts(counts).pages[key] || 0;
}

function prune(pages) {
  const keys = Object.keys(pages);
  if (keys.length <= PAGE_LIMIT) return pages;
  keys.sort((a, b) => pages[a] - pages[b] || a.localeCompare(b));
  const next = { ...pages };
  for (const key of keys.slice(0, keys.length - PAGE_LIMIT)) delete next[key];
  return next;
}
