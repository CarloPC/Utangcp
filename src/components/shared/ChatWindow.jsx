import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChat, MAX_TEXT } from '../../hooks/useChat';
import { validateImageFile } from '../../utils/gcash';
import ZoomableImage from './ImageLightbox';
import styles from './ChatWindow.module.css';

const QUICK_REPLIES = [
  'I can pay today 👍',
  "I can't pay yet, I'll update you soon.",
  'I already paid, but it is not recorded yet.',
];

const toDate = (ts) => ts?.toDate?.() ?? null;
const timeOf = (d) => d?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) ?? '';
const dayLabel = (d) => {
  if (!d) return '';
  const now = new Date();
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/**
 * One conversation. Used by the customer (inside the public passbook) and
 * by the owner (inside the Messages panel) — `role` decides which side "me" is.
 */
export default function ChatWindow({
  creditId,
  role, // 'customer' | 'owner'
  meta, // customer side: { ownerId, customerName, productName } used to create the thread
  title,
  subtitle,
  photoUrl,
  onClose,
  closeLabel = 'Close',
}) {
  const { messages, loading, send } = useChat({ creditId, role, meta });
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const lastCountRef = useRef(0);

  // Preview URL for the picked image (revoked when replaced / sent / unmounted)
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Stick to the bottom when new messages arrive
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const grew = messages.length !== lastCountRef.current;
    lastCountRef.current = messages.length;
    if (grew) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The last message I sent always shows its Seen state, and so does any photo I sent
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].sender === role) return messages[i].id;
    return null;
  }, [messages, role]);

  const items = useMemo(() => {
    const out = [];
    let lastDay = '';
    messages.forEach((m) => {
      const d = toDate(m.createdAt);
      const label = dayLabel(d);
      if (label !== lastDay) {
        out.push({ type: 'day', key: `day-${label}-${m.id}`, label });
        lastDay = label;
      }
      out.push({ type: 'msg', key: m.id, m, d });
    });
    return out;
  }, [messages]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problem = validateImageFile(f);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setFile(f);
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    setError('');
    try {
      await send({ text, file });
      setText('');
      setFile(null);
    } catch (err) {
      setError(err?.message?.length < 120 ? err.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.chat}>
      {/* ── Header ── */}
      <div className={styles.header}>
        {onClose && (
          <button type="button" className={styles.headBtn} onClick={onClose} aria-label={closeLabel}>
            {role === 'owner' ? '←' : '✕'}
          </button>
        )}
        {photoUrl ? (
          <img src={photoUrl} alt="" className={styles.headAvatar} />
        ) : (
          <span className={styles.headAvatarFallback}>{initialsOf(title)}</span>
        )}
        <div className={styles.headText}>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>

      {/* ── Messages ── (data-no-ptr: scrolling up here must not trigger pull-to-refresh) */}
      <div className={styles.list} ref={listRef} data-no-ptr aria-live="polite">
        {loading ? (
          <div className={styles.skelWrap} aria-label="Loading messages">
            {[60, 40, 70, 45].map((w, i) => (
              <span key={i} className={`${styles.skel} ${i % 2 ? styles.skelMine : ''}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>💬</span>
            <p>
              {role === 'customer'
                ? 'Send a message to the store. Let them know if you can pay, or send a photo of your receipt if your payment is not recorded yet.'
                : 'No messages yet.'}
            </p>
          </div>
        ) : (
          items.map((it) => {
            if (it.type === 'day') return <div key={it.key} className={styles.day}><span>{it.label}</span></div>;
            const { m, d } = it;
            const mine = m.sender === role;
            const showStatus = mine && (m.id === lastMineId || m.imageUrl);
            return (
              <div key={it.key} className={`${styles.row} ${mine ? styles.rowMine : ''}`}>
                <div className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                  {m.imageUrl && (
                    <ZoomableImage
                      src={m.imageUrl}
                      alt="Photo"
                      caption={`${m.sender === 'owner' ? 'Store' : title} • ${dayLabel(d)} ${timeOf(d)}`}
                      className={styles.photo}
                    />
                  )}
                  {m.text && <p className={styles.text}>{m.text}</p>}
                  <span className={styles.meta}>
                    {timeOf(d)}
                  </span>
                </div>
                {showStatus && (
                  <span className={`${styles.status} ${m.seenAt ? styles.statusSeen : ''}`}>
                    {m.seenAt ? `✓✓ Seen ${timeOf(toDate(m.seenAt))}` : '✓ Sent'}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Composer ── */}
      <form className={styles.composer} onSubmit={submit}>
        {role === 'customer' && !text && !file && (
          <div className={styles.chips}>
            {QUICK_REPLIES.map((q) => (
              <button key={q} type="button" className={styles.chip} onClick={() => setText(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {preview && (
          <div className={styles.pending}>
            <img src={preview} alt="Selected" />
            <button type="button" onClick={() => setFile(null)} aria-label="Remove photo">✕</button>
          </div>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.inputRow}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
          <button
            type="button"
            className={styles.attach}
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            aria-label="Attach a photo"
            title="Send a photo / receipt"
          >
            📷
          </button>
          <textarea
            className={styles.input}
            rows={1}
            maxLength={MAX_TEXT}
            placeholder={role === 'customer' ? 'Message the store…' : 'Reply…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
          />
          <button type="submit" className={styles.sendBtn} disabled={sending || (!text.trim() && !file)}>
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
