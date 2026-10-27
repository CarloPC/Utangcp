import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/format';
import { getPassbookStatus } from '../../utils/passbook';
import CustomerPassbookModal from './CustomerPassbookModal';
import styles from './CustomerGroupView.module.css';

const TONE = { success: styles.toneSuccess, warning: styles.toneWarning, danger: styles.toneDanger };

const isSettled = (m) => (Number(m.price) || 0) - (Number(m.paid) || 0) <= 0;
const fullName = (m) => `${m.firstname} ${m.lastname}`.trim();
const initials = (m) => ((m.firstname?.[0] || '') + (m.lastname?.[0] || '')).toUpperCase() || '?';

function Card({ member, onOpen }) {
  const s = useMemo(() => getPassbookStatus(member), [member]);
  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <div className={styles.cardTop}>
        {member.photo_url ? (
          <img src={member.photo_url} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarFallback}>{initials(member)}</div>
        )}
        <div className={styles.cardId}>
          <span className={styles.cardName}>{fullName(member)}</span>
          <span className={styles.cardProduct}>{member.product_name}</span>
        </div>
      </div>

      <div className={styles.meter}>
        <div className={styles.meterTrack}>
          <div
            className={`${styles.meterFill} ${s.tone === 'danger' ? styles.fillDanger : ''}`}
            style={{ width: `${s.percent}%` }}
          />
        </div>
        <span className={styles.meterPct}>{s.percent}%</span>
      </div>

      <div className={styles.cardFoot}>
        <div>
          <span className={styles.footLabel}>Remaining</span>
          <strong className={s.balance > 0 ? styles.owed : styles.paid}>{formatCurrency(s.balance)}</strong>
        </div>
        <span className={`${styles.badge} ${TONE[s.tone] || ''}`}>{s.badge}</span>
      </div>
      <span className={styles.since}>Purchased {formatDate(member.date)}</span>
    </button>
  );
}

/**
 * Public, read-only list of customers (the "garage"). Tapping a card opens that
 * customer's full passbook. Receives ONLY the sanitized shared_groups document.
 */
export default function CustomerGroupView({ group, groupId, loading, error, isDark, onToggleTheme }) {
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState(null);
  const [filter, setFilter] = useState('all'); // all | ongoing | settled

  const members = useMemo(() => group?.members || [], [group]);
  const counts = useMemo(() => {
    const settled = members.filter(isSettled).length;
    return { all: members.length, settled, ongoing: members.length - settled };
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .map((m, i) => ({ m, i })) // keep original index so the detail view opens the right customer
      .filter(({ m }) => {
        if (filter === 'settled' && !isSettled(m)) return false;
        if (filter === 'ongoing' && isSettled(m)) return false;
        return !q || fullName(m).toLowerCase().includes(q) || (m.product_name || '').toLowerCase().includes(q);
      });
  }, [members, query, filter]);

  // The opened customer's passbook, plus what the pay panel needs from the
  // list itself: the owner id (for the receipt record) and the GCash QR.
  const selected = useMemo(
    () =>
      openIdx !== null && members[openIdx]
        ? { ...members[openIdx], ownerId: group.ownerId, payment: group.payment || null }
        : null,
    [openIdx, members, group]
  );

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  useEffect(() => {
    if (group?.title) document.title = group.title;
  }, [group]);

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.center}><span className={styles.spinner} /><p>Opening list…</p></div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className={styles.overlay}>
        <div className={styles.messageCard}>
          <h1>{error === 'unavailable' ? "Can't load this list" : "This link isn't active"}</h1>
          <p>
            {error === 'unavailable'
              ? 'Please check your internet connection and try again.'
              : 'The link is invalid or the store has stopped sharing it. Please ask the store for a new link.'}
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className={styles.overlay}>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.topBar}>
            <span className={styles.brand}>UtangCP Passbooks</span>
            {onToggleTheme && (
              <button type="button" className={styles.iconBtn} onClick={onToggleTheme} aria-label="Toggle light/dark theme">
                {isDark ? '☀️' : '🌙'}
              </button>
            )}
          </div>
          <h1 className={styles.title}>{group.title}</h1>
          <p className={styles.sub}>
            {members.length} {members.length === 1 ? 'customer' : 'customers'}. Tap a card to see the full passbook.
          </p>
          {members.length > 1 && (
            <div className={styles.filters} role="group" aria-label="Filter by status">
              {[
                ['all', 'All'],
                ['ongoing', 'Ongoing'],
                ['settled', 'Settled'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.chip} ${filter === key ? styles.chipActive : ''}`}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label} <span className={styles.chipCount}>{counts[key]}</span>
                </button>
              ))}
            </div>
          )}
          {members.length > 1 && (
            <input
              className={styles.search}
              type="search"
              placeholder="Search name or item…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search this list"
            />
          )}
        </header>

        <main className={styles.grid}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>
              {members.length === 0
                ? 'No customers in this list.'
                : query.trim()
                  ? `No ${filter === 'all' ? '' : filter + ' '}customers match “${query}”.`
                  : `No ${filter} customers in this list.`}
            </p>
          ) : (
            filtered.map(({ m, i }) => <Card key={m.creditId || i} member={m} onOpen={() => setOpenIdx(i)} />)
          )}
        </main>

        <footer className={styles.footer}>Read-only view shared by your store.</footer>
      </div>

      {selected && (
        <CustomerPassbookModal
          passbook={selected}
          groupId={groupId}
          onClose={() => setOpenIdx(null)}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
        />
      )}
    </div>
  );
}
