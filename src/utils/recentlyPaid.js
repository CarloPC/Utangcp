// Shared "recently paid" tracker.
// Marks which customers have received a payment TODAY, regardless of
// whether that payment was added via Bulk Add or the Payment History tab.
// Backed by localStorage so it's shared across tabs/components and persists
// only for the current day.

const STORAGE_KEY = 'recentlyPaid';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function loadRecentlyPaid() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const { date, ids } = JSON.parse(raw);
    // Discard if it was saved on a different day
    if (date !== getTodayKey()) return new Set();
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function saveRecentlyPaid(set) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: getTodayKey(), ids: [...set] })
    );
  } catch {
    // localStorage unavailable â€” silently ignore
  }
}

// Mark one or more customer ids as paid today. Returns the updated Set.
export function markRecentlyPaid(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  const next = new Set([...loadRecentlyPaid(), ...list]);
  saveRecentlyPaid(next);
  return next;
}

// Remove one or more customer ids from the "recently paid" set. Call this
// when a today-dated payment is deleted (or a customer record is removed)
// so Bulk Add's "Paid this session" tag doesn't linger for a payment that
// no longer exists. Returns the updated Set.
export function unmarkRecentlyPaid(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  const next = loadRecentlyPaid();
  list.forEach((id) => next.delete(id));
  saveRecentlyPaid(next);
  return next;
}