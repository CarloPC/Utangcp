import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChat, MAX_TEXT, REACTIONS, REACTION_BY_KEY } from '../../hooks/useChat';
import { validateImageFile } from '../../utils/gcash';
import ZoomableImage from './ImageLightbox';
import Avatar from './Avatar';
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
  photoUrl, // the OTHER person's picture (owner sees the customer, customer sees the owner) — also used for the "Seen" avatar
  onClose,
  closeLabel = 'Close',
}) {
  const { messages, loading, send, react, setTyping, otherTyping, editMessage, unsendMessage } = useChat({
    creditId,
    role,
    meta,
  });
  const [picker, setPicker] = useState(null); // { id, below } — message whose reaction bar is open
  const pressRef = useRef(null);
  const [editing, setEditing] = useState(null); // { id, text } — customer editing their own message
  const [editBusy, setEditBusy] = useState(false);
  const [openHist, setOpenHist] = useState(() => new Set()); // owner: messages whose full edit history is expanded
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
    // Mark the last message of each run from the same sender (gets the little avatar)
    out.forEach((it, idx) => {
      if (it.type !== 'msg') return;
      const next = out[idx + 1];
      it.lastInRun = !next || next.type !== 'msg' || next.m.sender !== it.m.sender;
    });
    return out;
  }, [messages]);

  // Scroll down when the typing bubble appears (only if already near the bottom)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && otherTyping && el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  }, [otherTyping]);

  // Close the reaction bar on outside tap / Escape
  useEffect(() => {
    if (!picker) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && e.target.closest?.('[data-reaction-ui]')) return;
      setPicker(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [picker]);

  const openPicker = (id, el) => {
    // Open below the bubble when it is too close to the top of the list to fit above
    const list = listRef.current;
    const below = Boolean(list && el && el.getBoundingClientRect().top - list.getBoundingClientRect().top < 130);
    setPicker({ id, below, confirm: false });
  };
  const cancelPress = () => {
    clearTimeout(pressRef.current);
    pressRef.current = null;
  };
  const startPress = (e, id) => {
    if (e.pointerType === 'mouse') return;
    const el = e.currentTarget;
    cancelPress();
    pressRef.current = setTimeout(() => openPicker(id, el), 420);
  };
  useEffect(() => cancelPress, []);

  const pickReaction = (m, key) => {
    const mineNow = m.reactions?.[role];
    setPicker(null);
    react(m.id, mineNow === key ? null : key).catch(() => setError('Could not send your reaction.'));
  };

  const saveEdit = async () => {
    if (!editing || editBusy) return;
    setEditBusy(true);
    setError('');
    try {
      await editMessage(editing.id, editing.text);
      setEditing(null);
    } catch (err) {
      setError(err?.message?.length < 120 ? err.message : 'Could not save your edit. Please try again.');
    } finally {
      setEditBusy(false);
    }
  };
  const doUnsend = async (id) => {
    setPicker(null);
    setError('');
    try {
      await unsendMessage(id);
    } catch {
      setError('Could not unsend this message. Please try again.');
    }
  };
  const toggleHist = (id) =>
    setOpenHist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      setTyping(false);
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
        <Avatar url={photoUrl} name={title} size={40} ring />
        <div className={styles.headText}>
          <strong>{title}</strong>
          {otherTyping ? <span className={styles.headTyping}>typing…</span> : subtitle && <span>{subtitle}</span>}
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
            const unsent = Boolean(m.unsentAt);
            const hist = m.editHistory || [];
            const edited = hist.length > 0 || Boolean(m.editedAt);
            const isOwnerView = role === 'owner';
            // The customer never sees what they unsent; the owner always does.
            const goneForMe = unsent && !isOwnerView;
            const canAct = role === 'customer' && mine && !unsent; // Edit / Unsend
            const isEditing = editing?.id === m.id;
            const live = !unsent && !isEditing; // reactions + gestures
            const showStatus = mine && !goneForMe && (m.id === lastMineId || m.imageUrl);
            const reactions = live
              ? Object.entries(m.reactions || {}).filter(([, k]) => REACTION_BY_KEY[k])
              : [];
            const myReaction = m.reactions?.[role];
            const open = live && picker?.id === m.id;
            const names = { [role]: 'You', [role === 'owner' ? 'customer' : 'owner']: title };
            const histOpen = openHist.has(m.id);
            const histTime = (at) => {
              const dt = new Date(at);
              return `${dayLabel(dt)} ${timeOf(dt)}`;
            };
            const mkBtn = (label, glyph) => (
              <button
                type="button"
                className={styles.reactBtn}
                data-reaction-ui
                onClick={(e) => (open ? setPicker(null) : openPicker(m.id, e.currentTarget.parentElement))}
                aria-label={label}
                aria-expanded={open}
              >
                {glyph}
              </button>
            );
            const reactBtn = live ? mkBtn('React to this message', '☺') : null;
            const moreBtn = canAct && live ? mkBtn('Edit or unsend this message', '⋯') : null;

            return (
              <div
                key={it.key}
                className={`${styles.row} ${mine ? styles.rowMine : ''} ${reactions.length ? styles.hasReactions : ''}`}
              >
                {unsent && isOwnerView && (
                  <span className={styles.unsentFlag}>
                    🚫 Customer unsent this message • {dayLabel(toDate(m.unsentAt))} {timeOf(toDate(m.unsentAt))}
                  </span>
                )}

                <div className={styles.line}>
                  {!mine && (
                    <span className={styles.sideAvatar}>
                      {it.lastInRun && <Avatar url={photoUrl} name={title} size={26} />}
                    </span>
                  )}
                  {mine && moreBtn}
                  {mine && reactBtn}

                  <div className={styles.bubbleWrap}>
                    {open && (
                      <div
                        className={`${styles.picker} ${picker.below ? styles.pickerBelow : ''} ${mine ? styles.pickerMine : ''}`}
                        data-reaction-ui
                      >
                        <div className={styles.pickRow} role="menu" aria-label="Choose a reaction">
                          {REACTIONS.map((r, i) => (
                            <button
                              key={r.key}
                              type="button"
                              role="menuitem"
                              className={`${styles.pick} ${myReaction === r.key ? styles.pickOn : ''}`}
                              style={{ animationDelay: `${i * 30}ms` }}
                              onClick={() => pickReaction(m, r.key)}
                              aria-label={r.label}
                              title={r.label}
                            >
                              {r.emoji}
                            </button>
                          ))}
                        </div>

                        {canAct &&
                          (picker.confirm ? (
                            <div className={styles.menu}>
                              <p className={styles.menuNote}>
                                Unsend this message? The store keeps a record of unsent messages.
                              </p>
                              <div className={styles.menuRow}>
                                <button type="button" className={styles.menuItem} onClick={() => setPicker({ ...picker, confirm: false })}>
                                  Cancel
                                </button>
                                <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={() => doUnsend(m.id)}>
                                  Unsend
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.menu} role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.menuItem}
                                onClick={() => {
                                  setPicker(null);
                                  setEditing({ id: m.id, text: m.text || '' });
                                }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={`${styles.menuItem} ${styles.menuDanger}`}
                                onClick={() => setPicker({ ...picker, confirm: true })}
                              >
                                🗑️ Unsend
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    <div
                      className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs} ${
                        goneForMe ? styles.bubbleGone : ''
                      } ${unsent && isOwnerView ? styles.bubbleUnsent : ''}`}
                      onPointerDown={live ? (e) => startPress(e, m.id) : undefined}
                      onPointerUp={live ? cancelPress : undefined}
                      onPointerLeave={live ? cancelPress : undefined}
                      onPointerCancel={live ? cancelPress : undefined}
                      onContextMenu={
                        live
                          ? (e) => {
                              e.preventDefault();
                              openPicker(m.id, e.currentTarget);
                            }
                          : undefined
                      }
                      onDoubleClick={live ? () => pickReaction(m, 'like') : undefined}
                    >
                      {goneForMe ? (
                        <p className={styles.text}>You unsent a message</p>
                      ) : (
                        <>
                          {m.imageUrl && (
                            <ZoomableImage
                              src={m.imageUrl}
                              alt="Photo"
                              caption={`${m.sender === 'owner' ? 'Store' : title} • ${dayLabel(d)} ${timeOf(d)}`}
                              className={styles.photo}
                            />
                          )}
                          {isEditing ? (
                            <div className={styles.editBox}>
                              <textarea
                                className={styles.editInput}
                                autoFocus
                                rows={2}
                                maxLength={MAX_TEXT}
                                value={editing.text}
                                disabled={editBusy}
                                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditing(null);
                                  else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    saveEdit();
                                  }
                                }}
                                aria-label="Edit your message"
                              />
                              <div className={styles.editBtns}>
                                <button type="button" onClick={() => setEditing(null)} disabled={editBusy}>
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className={styles.editSave}
                                  onClick={saveEdit}
                                  disabled={editBusy || !editing.text.trim()}
                                >
                                  {editBusy ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            m.text && <p className={styles.text}>{m.text}</p>
                          )}
                        </>
                      )}
                      <span className={styles.meta}>
                        {timeOf(d)}
                        {edited && !goneForMe && ' • Edited'}
                      </span>
                    </div>

                    {reactions.length > 0 && (
                      <button
                        type="button"
                        className={`${styles.reactions} ${mine ? styles.reactionsMine : ''}`}
                        data-reaction-ui
                        onClick={(e) => openPicker(m.id, e.currentTarget.parentElement)}
                        title={reactions.map(([side, k]) => `${names[side]}: ${REACTION_BY_KEY[k].label}`).join(' • ')}
                        aria-label={`Reactions: ${reactions.map(([side, k]) => `${names[side]} ${REACTION_BY_KEY[k].label}`).join(', ')}`}
                      >
                        {[...new Set(reactions.map(([, k]) => REACTION_BY_KEY[k].emoji))].join('')}
                        {reactions.length > 1 && <span>{reactions.length}</span>}
                      </button>
                    )}
                  </div>

                  {!mine && reactBtn}
                </div>

                {/* ── Owner-only audit trail: what the customer wrote BEFORE editing ── */}
                {isOwnerView && hist.length > 0 && (
                  <div className={styles.audit}>
                    <p className={styles.auditHead}>
                      ✏️ Edited {hist.length > 1 ? `${hist.length} times` : 'once'}
                      {m.editedAt && ` • last edit ${dayLabel(toDate(m.editedAt))} ${timeOf(toDate(m.editedAt))}`}
                    </p>
                    {histOpen ? (
                      <ol className={styles.auditList}>
                        {hist.map((h, i) => (
                          <li key={i}>
                            <span>{i === 0 ? 'Original' : `Version ${i + 1}`} • {histTime(h.at)}</span>
                            <q>{h.text || '(photo only, no text)'}</q>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className={styles.auditLast}>
                        Before the edit: <q>{hist[hist.length - 1].text || '(photo only, no text)'}</q>
                      </p>
                    )}
                    {hist.length > 1 && (
                      <button type="button" className={styles.auditToggle} onClick={() => toggleHist(m.id)}>
                        {histOpen ? 'Show less' : `Show all ${hist.length} versions`}
                      </button>
                    )}
                  </div>
                )}

                {showStatus && (
                  <span className={`${styles.status} ${m.seenAt ? styles.statusSeen : ''}`}>
                    {m.seenAt ? (
                      <>
                        <Avatar url={photoUrl} name={title} size={16} />
                        Seen {timeOf(toDate(m.seenAt))}
                      </>
                    ) : (
                      '✓ Sent'
                    )}
                  </span>
                )}
              </div>
            );
          })
        )}

        {otherTyping && (
          <div className={styles.row} aria-live="polite">
            <div className={styles.line}>
              <span className={styles.sideAvatar}><Avatar url={photoUrl} name={title} size={26} /></span>
              <div className={`${styles.bubble} ${styles.bubbleTheirs} ${styles.typingBubble}`} aria-label={`${title} is typing`}>
                <i /><i /><i />
              </div>
            </div>
          </div>
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
            onChange={(e) => {
              setText(e.target.value);
              setTyping(e.target.value.trim().length > 0);
            }}
            onBlur={() => setTyping(false)}
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
