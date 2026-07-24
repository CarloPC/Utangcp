/**
 * Module-level singleton that captures the browser's install prompt
 * the moment it fires, regardless of whether any React component is
 * mounted yet to listen for it.
 *
 * Why this exists: `beforeinstallprompt` typically fires once, early
 * during page load — often before the user has even logged in, i.e.
 * before Header/InstallPopup exist in the tree. A hook that attaches
 * its listener inside a component's useEffect only catches the event
 * if it's already mounted at that exact moment. This file is imported
 * once in main.jsx, so its listener attaches as early as possible and
 * the captured event survives for the rest of the page's lifetime —
 * every login after that can reuse the same captured prompt.
 */

let deferredPrompt = null;
let isInstalled =
  typeof window !== 'undefined' &&
  window.matchMedia('(display-mode: standalone)').matches;

// IMPORTANT: useSyncExternalStore requires getSnapshot() to return the
// SAME object reference across calls when nothing has changed — returning
// a fresh `{ ... }` literal every call causes React to think the store is
// changing on every render, which throws an infinite-loop error and blanks
// the whole app. We cache the snapshot and only replace it when the
// underlying values actually change.
let snapshot = { canInstall: false, isInstalled };
function updateSnapshot() {
  snapshot = { canInstall: !!deferredPrompt, isInstalled };
}

const listeners = new Set();
function emit() {
  updateSnapshot();
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    emit();
  });
}

export function getSnapshot() {
  return snapshot;
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Returns 'accepted' | 'dismissed' | 'unavailable' */
export async function triggerInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return choice.outcome;
}