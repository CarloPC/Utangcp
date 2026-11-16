import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  increment,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
*/
export const CHATS = 'chats';
export const MAX_TEXT = 1000;

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

  useEffect(() => {
    if (!creditId) return undefined;
    setLoading(true);
    markedRef.current = new Set();

    const unsubThread = onSnapshot(
      doc(db, CHATS, creditId),
      (snap) => setThread(snap.exists() ? snap.data() : null),
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
  useEffect(() => {
    if (!creditId || !active) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const unseen = messages.filter(
      (m) => m.sender === other(role) && !m.seenAt && !markedRef.current.has(m.id)
    );
    const myUnread = thread?.[`${role}Unread`] || 0;
    if (unseen.length === 0 && myUnread === 0) return;

    unseen.forEach((m) => markedRef.current.add(m.id));
    const batch = writeBatch(db);
    unseen.slice(0, 400).forEach((m) =>
      batch.update(doc(db, CHATS, creditId, 'messages', m.id), { seenAt: serverTimestamp() })
    );
    batch.set(
      doc(db, CHATS, creditId),
      { [`${role}Unread`]: 0, [`${role}LastSeenAt`]: serverTimestamp() },
      { merge: true }
    );
    batch.commit().catch(() => unseen.forEach((m) => markedRef.current.delete(m.id)));
  }, [messages, thread, creditId, role, active]);

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
        },
        { merge: true }
      );
      await batch.commit();
    },
    [creditId, role, meta]
  );

  const unread = thread?.[`${role}Unread`] || 0;
  return { messages, thread, loading, send, unread };
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
