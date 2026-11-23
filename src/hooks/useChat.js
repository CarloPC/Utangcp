import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteField,
  doc,
  increment,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { compressImage, extFor, randomName, uploadPublicFile, validateImageFile } from '../utils/gcash';

/*  Data model
    chats/{creditId}                      one conversation per customer account
        ownerId, creditId, customerName, productName,
        lastMessage, lastSender, lastMessageAt,
        ownerUnread, customerUnread       (counters for the red badges)
    chats/{creditId}/messages/{id}
        sender: 'customer' | 'owner', text, imageUrl, imagePath,
        createdAt, seenAt                 (seenAt = the other side opened it)
        reactions: { customer?: key, owner?: key }   (one reaction per side)
        -- customer edit / unsend (the owner keeps the full audit trail) --
        text                              always the CURRENT text (what the customer sees)
        editedAt, editHistory: [{ text, at }]   every previous version, oldest first
        unsentAt                          set when the customer unsends; text/imageUrl stay
                                          in place so the owner can still read them
    chats/{creditId}.customerTypingAt / ownerTypingAt  (heartbeat; 0 = stopped)
*/
export const CHATS = 'chats';
export const MAX_TEXT = 1000;

// Messenger-style reactions. `key` is what gets stored in Firestore.
export const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'haha', emoji: '😆', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
];
export const REACTION_BY_KEY = Object.fromEntries(REACTIONS.map((r) => [r.key, r]));

const TYPING_HEARTBEAT_MS = 2500; // how often we re-announce "still typing"
const TYPING_IDLE_MS = 4000; // stop announcing after this long without a keystroke
const TYPING_EXPIRE_MS = 6000; // other side: no heartbeat for this long = stopped

const other = (role) => (role === 'owner' ? 'customer' : 'owner');

/**
 * One conversation, for either side.
 *   role 'customer' -> public passbook visitor (no login)
 *   role 'owner'    -> the signed-in store owner
 * `meta` is only used by the customer side to create the thread the first time.
 */
export function useChat({ creditId, role, meta, active = true }) {
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(Boolean(creditId));
  const markedRef = useRef(new Set()); // message ids we already marked as seen
  const [otherTyping, setOtherTyping] = useState(false);
  const typingBaseRef = useRef(null); // the other side's typing value when we opened the chat
  const lastTypingWriteRef = useRef(0);
  const typingIdleRef = useRef(null);
  const threadExistsRef = useRef(false);

  // Is this screen actually showing? (tab in front / phone unlocked). When it flips to
  // visible we must re-run the "mark as seen" step — messages that arrived while the
  // tab was in the background would otherwise stay "unseen" until the next message.
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
    };
  }, []);

  useEffect(() => {
    if (!creditId) return undefined;
    setLoading(true);
    markedRef.current = new Set();
    typingBaseRef.current = null;
    setOtherTyping(false);

    const unsubThread = onSnapshot(
      doc(db, CHATS, creditId),
      (snap) => {
        threadExistsRef.current = snap.exists();
        setThread(snap.exists() ? snap.data() : null);
      },
      () => setThread(null)
    );
    const unsubMsgs = onSnapshot(
      query(collection(db, CHATS, creditId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(200)),
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => {
      unsubThread();
      unsubMsgs();
    };
  }, [creditId]);

  // ── Mark the other side's messages as seen while this chat is on screen ──
  // Runs on every new message (live) AND when the screen becomes visible again.
  // The message updates and the thread counter are separate writes, so one
  // failing can never block the other.
  useEffect(() => {
    if (!creditId || !active || !visible) return;

    const unseen = messages.filter(
      (m) => m.sender === other(role) && !m.seenAt && !markedRef.current.has(m.id)
    );
    const myUnread = thread?.[`${role}Unread`] || 0;
    if (unseen.length === 0 && myUnread === 0) return;

    if (unseen.length > 0) {
      unseen.forEach((m) => markedRef.current.add(m.id));
      const batch = writeBatch(db);
      unseen.slice(0, 400).forEach((m) =>
        batch.update(doc(db, CHATS, creditId, 'messages', m.id), { seenAt: serverTimestamp() })
      );
      batch.commit().catch((err) => {
        console.warn('Could not mark messages as seen:', err);
        unseen.forEach((m) => markedRef.current.delete(m.id)); // retry on the next change
      });
    }
    if (thread && (myUnread > 0 || unseen.length > 0)) {
      updateDoc(doc(db, CHATS, creditId), {
        [`${role}Unread`]: 0,
        [`${role}LastSeenAt`]: serverTimestamp(),
      }).catch((err) => console.warn('Could not reset unread counter:', err));
    }
  }, [messages, thread, creditId, role, active, visible]);

  // ── Send a text and/or image message ──
  const send = useCallback(
    async ({ text = '', file = null }) => {
      const clean = text.trim().slice(0, MAX_TEXT);
      if (!clean && !file) return;

      let imageUrl = null;
      let imagePath = null;
      if (file) {
        const problem = validateImageFile(file);
        if (problem) throw new Error(problem);
        const blob = await compressImage(file);
        const up = await uploadPublicFile(`receipts/chat/${creditId}/${randomName()}.${extFor(blob)}`, blob);
        imageUrl = up.url;
        imagePath = up.path;
      }

      const batch = writeBatch(db);
      const msgRef = doc(collection(db, CHATS, creditId, 'messages'));
      batch.set(msgRef, {
        sender: role,
        text: clean,
        imageUrl,
        imagePath,
        createdAt: serverTimestamp(),
        seenAt: null,
      });
      batch.set(
        doc(db, CHATS, creditId),
        {
          ...(role === 'customer' ? meta : {}),
          creditId,
          lastMessage: clean || '📷 Photo',
          lastSender: role,
          lastMessageAt: serverTimestamp(),
          [`${other(role)}Unread`]: increment(1),
          [`${role}TypingAt`]: 0,
        },
        { merge: true }
      );
      await batch.commit();
      lastTypingWriteRef.current = 0;
    },
    [creditId, role, meta]
  );

  // ── Is the other side typing? ──
  // Compared by *change*, not by clock, so a phone with a wrong clock still works.
  const otherTypingAt = thread?.[`${other(role)}TypingAt`] || 0;
  useEffect(() => {
    if (!thread) return undefined;
    if (typingBaseRef.current === null) typingBaseRef.current = otherTypingAt; // ignore stale value on open
    if (!otherTypingAt || otherTypingAt === typingBaseRef.current) {
      setOtherTyping(false);
      return undefined;
    }
    setOtherTyping(true);
    const t = setTimeout(() => setOtherTyping(false), TYPING_EXPIRE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherTypingAt, Boolean(thread)]);

  // Tell the other side we are typing (call on every keystroke; it throttles itself)
  const setTyping = useCallback(
    (on) => {
      clearTimeout(typingIdleRef.current);
      if (!creditId || !threadExistsRef.current) return; // never create a thread just for typing
      const field = `${role}TypingAt`;
      const ref = doc(db, CHATS, creditId);
      if (on) {
        const now = Date.now();
        if (now - lastTypingWriteRef.current >= TYPING_HEARTBEAT_MS) {
          lastTypingWriteRef.current = now;
          updateDoc(ref, { [field]: now }).catch(() => {});
        }
        typingIdleRef.current = setTimeout(() => setTypingRef.current(false), TYPING_IDLE_MS);
      } else if (lastTypingWriteRef.current) {
        lastTypingWriteRef.current = 0;
        updateDoc(ref, { [field]: 0 }).catch(() => {});
      }
    },
    [creditId, role]
  );
  const setTypingRef = useRef(setTyping);
  setTypingRef.current = setTyping;
  useEffect(() => () => setTypingRef.current(false), [creditId]); // leaving the chat = stopped typing

  // ── React to a message (type = key from REACTIONS, or null to remove mine) ──
  const react = useCallback(
    (messageId, type) =>
      updateDoc(doc(db, CHATS, creditId, 'messages', messageId), {
        [`reactions.${role}`]: type || deleteField(),
      }),
    [creditId, role]
  );

  // ── Customer only: edit / unsend one of their own messages ──────────────
  // Nothing is ever erased. An edit pushes the old text onto `editHistory`;
  // an unsend only sets `unsentAt`. The owner's screen shows both; the
  // customer's screen shows only the new text ("Edited") or "unsent".
  // The message write is the one that matters (and the one the rules guard), so it
  // goes first and on its own. The inbox bookkeeping afterwards is best-effort.
  const touchThread = (message, preview) => {
    const isLast = messages.length > 0 && messages[messages.length - 1].id === message.id;
    return updateDoc(doc(db, CHATS, creditId), {
      ownerUnread: increment(1), // red dot: "the customer changed something"
      ...(isLast ? { lastMessage: preview, lastSender: 'customer' } : {}),
    }).catch((err) => console.warn('[chat] could not update inbox preview:', err));
  };

  const editMessage = useCallback(
    async (messageId, newText) => {
      if (role !== 'customer') return;
      const m = messages.find((x) => x.id === messageId);
      const clean = (newText || '').trim().slice(0, MAX_TEXT);
      if (!m || m.sender !== 'customer' || m.unsentAt) return;
      if (!clean) throw new Error('A message can\'t be empty. Use Unsend to remove it.');
      if (clean === (m.text || '')) return;
      try {
        await updateDoc(doc(db, CHATS, creditId, 'messages', messageId), {
          text: clean,
          editedAt: serverTimestamp(),
          editHistory: [...(m.editHistory || []), { text: m.text || '', at: Date.now() }],
        });
      } catch (err) {
        console.error('[chat] edit blocked on the MESSAGE document:', err?.code, err?.message);
        throw err;
      }
      await touchThread(m, clean);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creditId, role, messages]
  );

  const unsendMessage = useCallback(
    async (messageId) => {
      if (role !== 'customer') return;
      const m = messages.find((x) => x.id === messageId);
      if (!m || m.sender !== 'customer' || m.unsentAt) return;
      try {
        await updateDoc(doc(db, CHATS, creditId, 'messages', messageId), { unsentAt: serverTimestamp() });
      } catch (err) {
        console.error('[chat] unsend blocked on the MESSAGE document:', err?.code, err?.message);
        throw err;
      }
      await touchThread(m, '🚫 Unsent a message');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creditId, role, messages]
  );

  const unread = thread?.[`${role}Unread`] || 0;
  return { messages, thread, loading, send, unread, react, setTyping, otherTyping, editMessage, unsendMessage };
}

/** Customer-side: just the unread count for the little badge on the chat button. */
export function useChatUnread(creditId, role = 'customer') {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!creditId) return undefined;
    return onSnapshot(
      doc(db, CHATS, creditId),
      (snap) => setUnread(snap.exists() ? snap.data()[`${role}Unread`] || 0 : 0),
      () => setUnread(0)
    );
  }, [creditId, role]);
  return unread;
}

/** Owner-side: every conversation, newest first, plus the total unread count. */
export function useOwnerChats(userId) {
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    if (!userId) {
      setThreads([]);
      return undefined;
    }
    // Single equality filter -> no composite index needed; sorted client-side.
    const q = query(collection(db, CHATS), where('ownerId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
        rows.sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0));
        setThreads(rows);
      },
      () => setThreads([])
    );
  }, [userId]);

  const totalUnread = useMemo(() => threads.reduce((s, t) => s + (t.ownerUnread || 0), 0), [threads]);
  return { threads, totalUnread };
}
