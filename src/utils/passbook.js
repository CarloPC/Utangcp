import { formatCurrency } from './format';

export const SHARE_PARAM = 'share';
export const SHARE_COLLECTION = 'shared_passbooks';
export const GROUP_PARAM = 'group';
export const GROUP_COLLECTION = 'shared_groups';

const DAY_MS = 86_400_000;

/* ────────────────────────────────────────────────────────────────
   Share-link helpers
──────────────────────────────────────────────────────────────── */

// 128 bits of randomness -> 32 hex chars. Unguessable, so the link itself
// is the "password". (Never use the Firestore customer id for this.)
export function newShareId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildShareUrl(shareId) {
  return `${window.location.origin}/?${SHARE_PARAM}=${shareId}`;
}

// Returns the raw ?share= value (or null when the param is absent).
export function getShareIdFromUrl() {
  const v = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  return v ? v.trim() : null;
}

export function buildGroupUrl(groupId) {
  return `${window.location.origin}/?${GROUP_PARAM}=${groupId}`;
}

export function getGroupIdFromUrl() {
  const v = new URLSearchParams(window.location.search).get(GROUP_PARAM);
  return v ? v.trim() : null;
}

export function isValidShareId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(id);
}

// Clipboard write that works on https, and falls back to execCommand.
// NOTE: call it synchronously inside the click handler (before any `await`)
// so Safari still treats it as part of the user gesture.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────
   Snapshot written to the public `shared_passbooks/{shareId}` doc.
   ONLY whitelisted fields go in here — no mobile number, no owner
   email, no other customers, no store totals.
──────────────────────────────────────────────────────────────── */
export function buildPassbookSnapshot(customer, customerPayments, ownerId, payInfo = null) {
  const price = Number(customer.price) || 0;
  const paid = Number(customer.paid) || 0;

  const payments = [...customerPayments]
    .sort(
      (a, b) =>
        String(a.payment_date).localeCompare(String(b.payment_date)) ||
        (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    )
    .map((p) => ({
      id: p.id,
      date: p.payment_date,
      amount: Number(p.amount) || 0,
    }));

  return {
    ownerId, // required by the security rules (owner-only writes)
    creditId: customer.id,
    firstname: customer.firstname || '',
    lastname: customer.lastname || '',
    photo_url: customer.photo_url || null,
    product_name: customer.product_name || '',
    date: customer.date || '',
    price,
    paid,
    remaining_balance: price - paid,
    payments,
    // Owner's GCash QR / payee (public by design — the customer must see it to pay)
    payment: payInfo || null,
  };
}

/* ────────────────────────────────────────────────────────────────
   Bulk share: ONE public doc holding a sanitized snapshot of each
   customer in the list (same fields as a single passbook).
──────────────────────────────────────────────────────────────── */
export const MAX_GROUP_BYTES = 900_000; // Firestore docs max out at ~1 MiB

export function buildGroupSnapshot(title, customers, payments, ownerId) {
  const byCredit = new Map();
  payments.forEach((p) => {
    if (!byCredit.has(p.credit_id)) byCredit.set(p.credit_id, []);
    byCredit.get(p.credit_id).push(p);
  });
  const members = customers
    .map((c) => {
      const snap = buildPassbookSnapshot(c, byCredit.get(c.id) || [], ownerId);
      delete snap.ownerId;
      delete snap.payment;
      return snap;
    })
    .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`));
  return { ownerId, title: (title || '').trim() || 'Customer Passbooks', members };
}

export const isGroupTooLarge = (snap) => new Blob([JSON.stringify(snap)]).size > MAX_GROUP_BYTES;

/* ────────────────────────────────────────────────────────────────
   Display logic (runs in the customer's browser)
──────────────────────────────────────────────────────────────── */

const parseDay = (s) => new Date(`${s}T00:00:00`);
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const diffDays = (a, b) => Math.round((b - a) / DAY_MS);

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * UtangCP records have no due date, so "days remaining" is an ESTIMATE
 * based on the customer's own payment rhythm:
 *   typical payment  = median payment amount
 *   payments left    = ceil(balance / typical payment)
 *   days left        = payments left × average days between payment days
 * "Overdue" = no payment for longer than twice the usual gap (min 3 days).
 */
export function getPassbookStatus(pb, now = startOfToday()) {
  const price = Number(pb.price) || 0;
  const paid = Number(pb.paid) || 0;
  const balance = Math.max(0, price - paid);
  const payments = pb.payments || [];
  const percent =
    balance <= 0 ? 100 : Math.min(99, Math.max(0, Math.round((paid / price) * 100) || 0));

  const base = { percent, balance, daysLeft: null, sinceLast: null };

  if (balance <= 0) {
    return {
      ...base,
      key: 'settled',
      tone: 'success',
      badge: 'Fully Settled',
      big: '✓',
      unit: 'paid in full',
      detail: 'Thank you! There is nothing left to pay on this account.',
    };
  }

  if (!payments.length) {
    return {
      ...base,
      key: 'pending',
      tone: 'warning',
      badge: 'No Payments Yet',
      big: '—',
      unit: 'waiting for first payment',
      detail: 'Your payments will show up here as soon as they are recorded.',
    };
  }

  const dates = [...new Set(payments.map((p) => p.date))].sort();
  const first = parseDay(dates[0]);
  const last = parseDay(dates[dates.length - 1]);
  const sinceLast = Math.max(0, diffDays(last, now));
  const avgGap =
    dates.length > 1 ? Math.max(1, diffDays(first, last) / (dates.length - 1)) : 1;
  const typical = median(payments.map((p) => p.amount).filter((a) => a > 0)) || 1;
  const daysLeft = Math.ceil(Math.ceil(balance / typical) * avgGap);
  const grace = Math.max(3, Math.ceil(avgGap * 2));
  const estimate = `At your usual pace (about ${formatCurrency(Math.round(typical))} per payment), you should finish in roughly ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;

  if (sinceLast > grace) {
    return {
      ...base,
      daysLeft,
      sinceLast,
      key: 'overdue',
      tone: 'danger',
      badge: 'Overdue',
      big: String(sinceLast),
      unit: 'days since last payment',
      detail: `Your last payment was ${sinceLast} days ago. ${estimate}`,
    };
  }

  return {
    ...base,
    daysLeft,
    sinceLast,
    key: 'on-track',
    tone: 'success',
    badge: 'On Track',
    big: `≈ ${daysLeft}`,
    unit: `day${daysLeft === 1 ? '' : 's'} left (estimate)`,
    detail: estimate,
  };
}

/**
 * Turns the payment list into ledger rows with a running balance.
 * If `paid` on the record is higher than the sum of logged payments
 * (e.g. the owner edited the total by hand), the gap is shown as one
 * "Earlier payments" row so the balance column always adds up.
 */
export function buildLedger(pb) {
  const price = Number(pb.price) || 0;
  const paid = Number(pb.paid) || 0;
  const payments = pb.payments || [];
  const logged = payments.reduce((s, p) => s + p.amount, 0);
  const earlier = Math.max(0, paid - logged);

  let running = price;
  const rows = [];
  if (earlier > 0) {
    running -= earlier;
    rows.push({
      id: 'earlier',
      date: pb.date,
      amount: earlier,
      balanceAfter: Math.max(0, running),
      note: 'Earlier payments',
    });
  }
  payments.forEach((p) => {
    running -= p.amount;
    rows.push({ id: p.id, date: p.date, amount: p.amount, balanceAfter: Math.max(0, running) });
  });
  return rows;
}
