const CACHE_PREFIX = 'uce-bible-cache-v1:';

function storageKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

export function getCachedBibleValue(key) {
  try {
    const value = window.localStorage.getItem(storageKey(key));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function fetchAndCacheBibleValue(key, request) {
  const cacheKey = storageKey(key);
  const cached = getCachedBibleValue(key);
  if (!navigator.onLine && cached !== null) return cached;
  try {
    const value = await request();
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(value));
    } catch {
      // A full device cache must not prevent Bible reading while online.
    }
    return value;
  } catch (error) {
    if (cached !== null) return cached;
    throw error;
  }
}
