import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ChatWindow from '../shared/ChatWindow';
import Avatar from '../shared/Avatar';
import styles from './MessagesPanel.module.css';

function relTime(ts) {
  const d = ts?.toDate?.();
  if (!d) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const diffDays = Math.round((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Owner inbox: every customer conversation, newest first, with unread badges.
 * Opened from "Messages" in the profile menu.
 */
export default function MessagesPanel({ threads, customers, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState('');

  const photoById = useMemo(() => {
    const m = new Map();
    customers.forEach((c) => m.set(c.id, c.photo_url || null));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return threads;
    return threads.filter((t) => `${t.customerName} ${t.productName}`.toLowerCase().includes(s));
  }, [threads, q]);

  const selected = threads.find((t) => t.id === selectedId) || null;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedId) setSelectedId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, selectedId]);

  return createPortal(
    <div className={styles.backdrop}>
      <div className={`${styles.panel} ${selected ? styles.hasSelection : ''}`} role="dialog" aria-modal="true" aria-label="Messages">
        {/* ── Conversation list ── */}
        <aside className={styles.list}>
          <div className={styles.listHead}>
            <h2>Messages</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close messages">✕</button>
          </div>

          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search customer or product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search conversations"
            />
          </div>

          <div className={styles.threads} data-no-ptr>
            {filtered.length === 0 ? (
              <p className={styles.empty}>
                {threads.length === 0
                  ? 'No messages yet. When a customer messages you from their passbook link, it will show up here.'
                  : 'No conversations match your search.'}
              </p>
            ) : (
              filtered.map((t) => {
                const photo = photoById.get(t.id);
                const unread = t.ownerUnread || 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.thread} ${t.id === selectedId ? styles.threadActive : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <Avatar url={photo} name={t.customerName} size={44} />
                    <span className={styles.threadBody}>
                      <span className={styles.threadTop}>
                        <strong className={unread ? styles.unreadName : ''}>{t.customerName || 'Customer'}</strong>
                        <time>{relTime(t.lastMessageAt)}</time>
                      </span>
                      <span className={styles.product}>{t.productName}</span>
                      <span className={`${styles.preview} ${unread ? styles.previewUnread : ''}`}>
                        {t.lastSender === 'owner' ? 'You: ' : ''}
                        {t.lastMessage}
                      </span>
                    </span>
                    {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Open conversation ── */}
        <section className={styles.convo}>
          {selected ? (
            <ChatWindow
              key={selected.id}
              creditId={selected.id}
              role="owner"
              title={selected.customerName || 'Customer'}
              subtitle={selected.productName}
              photoUrl={photoById.get(selected.id)}
              onClose={() => setSelectedId(null)}
              closeLabel="Back to conversations"
            />
          ) : (
            <div className={styles.placeholder}>
              <span>💬</span>
              <p>Select a conversation to read and reply.</p>
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  );
}
