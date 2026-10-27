import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/format';
import { buildLedger, getPassbookStatus } from '../../utils/passbook';
import GcashPayPanel from './GcashPayPanel';
import styles from './CustomerPassbookModal.module.css';

const TONE_CLASS = {
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
};

function initials(pb) {
  return ((pb.firstname?.[0] || '') + (pb.lastname?.[0] || '')).toUpperCase() || '?';
}

function Message({ title, text }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.messageCard}>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}

/**
 * Public, STRICTLY READ-ONLY customer passbook.
 * It only ever receives the sanitized `shared_passbooks` document —
 * there are no edit/delete/add-payment handlers anywhere in this tree.
 *
 * @param {{ passbook: object|null, shareId?: string, groupId?: string, loading?: boolean, error?: string|null,
 *           onClose?: () => void, isDark?: boolean, onToggleTheme?: () => void }} props
 */
export default function CustomerPassbookModal({
  passbook,
  shareId,
  groupId,
  loading = false,
  error = null,
  onClose,
  isDark,
  onToggleTheme,
}) {
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);

  const status = useMemo(() => (passbook ? getPassbookStatus(passbook) : null), [passbook]);
  const ledger = useMemo(() => (passbook ? buildLedger(passbook) : []), [passbook]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? ledger
      : ledger.filter(
          (r) =>
            formatDate(r.date).toLowerCase().includes(q) ||
            String(r.date).includes(q) ||
            formatCurrency(r.amount).toLowerCase().includes(q) ||
            String(r.amount).includes(q.replace(/[₱,\s]/g, ''))
        );
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [ledger, query, newestFirst]);

  // Private link: keep it out of search engines, and give the tab a useful title.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    if (passbook) document.title = `${passbook.firstname}'s Passbook`;
  }, [passbook]);

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.loading}>
          <span className={styles.spinner} />
          <p>Opening passbook…</p>
        </div>
      </div>
    );
  }

  if (error || !passbook) {
    return error === 'unavailable' ? (
      <Message
        title="Can't load this passbook"
        text="Please check your internet connection and try again."
      />
    ) : (
      <Message
        title="This link isn't active"
        text="The passbook link is invalid or the store has stopped sharing it. Please ask the store for a new link."
      />
    );
  }

  const fullName = `${passbook.firstname} ${passbook.lastname}`.trim();
  const toneClass = TONE_CLASS[status.tone] || '';
  const updated = passbook.updatedAt?.toDate?.();

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${fullName} passbook`}>
      <div className={styles.sheet}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className={styles.hero}>
          <div className={styles.topBar}>
            <span className={styles.brand}>UtangCP Passbook</span>
            <div className={styles.topActions}>
              {onToggleTheme && (
                <button type="button" className={styles.iconBtn} onClick={onToggleTheme} aria-label="Toggle light/dark theme">
                  {isDark ? '☀️' : '🌙'}
                </button>
              )}
              {onClose && (
                <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className={styles.identity}>
            {passbook.photo_url ? (
              <img src={passbook.photo_url} alt={fullName} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>{initials(passbook)}</div>
            )}
            <div className={styles.identityText}>
              <h1 className={styles.name}>{fullName}</h1>
              <p className={styles.product}>{passbook.product_name}</p>
              <p className={styles.purchased}>Purchased {formatDate(passbook.date)}</p>
            </div>
          </div>

          <div className={styles.progress}>
            <div className={styles.percentRow}>
              <span className={styles.percent}>{status.percent}%</span>
              <span className={styles.percentLabel}>paid</span>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={status.percent}
              aria-label={`${status.percent}% paid`}
            >
              <div
                className={`${styles.fill} ${status.tone === 'danger' ? styles.fillDanger : ''}`}
                style={{ width: `${status.percent}%` }}
              />
              {[25, 50, 75].map((t) => (
                <span key={t} className={styles.tick} style={{ left: `${t}%` }} />
              ))}
            </div>
          </div>
        </header>

        {/* ── Totals ───────────────────────────────────────────── */}
        <section className={styles.totals} aria-label="Account summary">
          <div className={styles.total}>
            <span className={styles.totalLabel}>Total amount</span>
            <strong>{formatCurrency(passbook.price)}</strong>
          </div>
          <div className={styles.total}>
            <span className={styles.totalLabel}>Total paid</span>
            <strong className={styles.paid}>{formatCurrency(passbook.paid)}</strong>
          </div>
          <div className={styles.total}>
            <span className={styles.totalLabel}>Remaining balance</span>
            <strong className={status.balance > 0 ? styles.owed : styles.paid}>
              {formatCurrency(status.balance)}
            </strong>
          </div>
        </section>

        {/* ── Countdown / status ───────────────────────────────── */}
        <section className={`${styles.statusCard} ${toneClass}`} aria-label="Payment status">
          <div className={styles.countdown}>
            <span className={styles.big}>{status.big}</span>
            <span className={styles.unit}>{status.unit}</span>
          </div>
          <div className={styles.statusText}>
            <span className={styles.badge}>{status.badge}</span>
            <p>{status.detail}</p>
          </div>
        </section>

        {/* ── Pay with GCash (QR + receipt upload) ─────────────── */}
        {(shareId || groupId) && (
          <GcashPayPanel passbook={passbook} shareId={shareId} groupId={groupId} balance={status.balance} />
        )}

        {/* ── Payment history ──────────────────────────────────── */}
        <section className={styles.history} aria-label="Payment history">
          <div className={styles.historyHead}>
            <h2>Payment history</h2>
            <span className={styles.count}>
              {ledger.length} {ledger.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {ledger.length > 1 && (
            <div className={styles.controls}>
              <input
                className={styles.search}
                type="search"
                placeholder="Search by date or amount…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search payments"
              />
              <button
                type="button"
                className={styles.sortBtn}
                onClick={() => setNewestFirst((v) => !v)}
              >
                {newestFirst ? 'Newest first' : 'Oldest first'}
              </button>
            </div>
          )}

          {ledger.length === 0 ? (
            <p className={styles.empty}>No payments recorded yet.</p>
          ) : rows.length === 0 ? (
            <p className={styles.empty}>No payments match “{query}”.</p>
          ) : (
            <table className={styles.ledger}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className={styles.num}>Paid</th>
                  <th scope="col" className={styles.num}>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {formatDate(r.date)}
                      {r.note && <span className={styles.note}>{r.note}</span>}
                    </td>
                    <td className={`${styles.num} ${styles.paid}`}>{formatCurrency(r.amount)}</td>
                    <td className={styles.num}>{formatCurrency(r.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className={styles.footer}>
          This is a read-only view shared by your store.
          {updated && ` Last updated ${updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`}
        </footer>
      </div>
    </div>
  );
}
