const BUST_PARAM = '_r';

/**
 * Real "hard refresh": drops the service worker and every Cache Storage
 * entry, then reloads the same URL (keeps ?share= / ?group=) with a throw-away
 * query param so the browser can't answer the navigation from its HTTP cache.
 */
export async function hardRefresh() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* keep going */
  }
  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* keep going */
  }
  const url = new URL(window.location.href);
  url.searchParams.set(BUST_PARAM, String(Date.now()));
  window.location.replace(url.toString());
}

// Call once on startup: removes the throw-away param from the address bar.
export function cleanBustParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(BUST_PARAM)) return;
    url.searchParams.delete(BUST_PARAM);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    /* harmless */
  }
}

// True if the page holds typed/selected data that a reload would throw away.
export function hasUnsavedInput() {
  const fields = document.querySelectorAll(
    'input:not([type=search]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=button]):not([type=submit]), textarea'
  );
  return Array.from(fields).some((f) =>
    f.type === 'file' ? f.files && f.files.length > 0 : f.value !== '' && f.value !== f.defaultValue
  );
}
