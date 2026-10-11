import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  GROUP_COLLECTION, buildGroupSnapshot, buildGroupUrl, isGroupTooLarge, newShareId,
} from '../utils/passbook';

/**
 * Owner-side bulk sharing.
 *   users/{uid}/share_groups/{groupId}  -> PRIVATE registry (title + member ids),
 *                                          lets the owner list / revoke links
 *   shared_groups/{groupId}             -> PUBLIC sanitized copy the link reads
 * The public copy is re-synced whenever customers or payments change.
 */
export function useSharedGroups(userId, customers, payments, ready) {
  const [groups, setGroups] = useState([]);
  const synced = useRef(new Map()); // groupId -> last JSON written

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      return undefined;
    }
    const q = query(collection(db, 'users', userId, 'share_groups'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }, [userId]);

  // Keep every public list current
  useEffect(() => {
    if (!userId || !ready) return;
    groups.forEach((g) => {
      const ids = new Set(g.memberIds || []);
      const snap = buildGroupSnapshot(g.title, customers.filter((c) => ids.has(c.id)), payments, userId);
      const key = JSON.stringify(snap);
      if (synced.current.get(g.id) === key || isGroupTooLarge(snap)) return;
      synced.current.set(g.id, key);
      setDoc(doc(db, GROUP_COLLECTION, g.id), { ...snap, updatedAt: serverTimestamp() })
        .catch(() => synced.current.delete(g.id));
    });
  }, [userId, ready, groups, customers, payments]);

  // Returns { url, ready } synchronously (copy the URL inside the click gesture)
  const createGroupLink = useCallback(
    (title, customerIds) => {
      const groupId = newShareId();
      const url = buildGroupUrl(groupId);
      const ready = (async () => {
        const ids = new Set(customerIds);
        const snap = buildGroupSnapshot(title, customers.filter((c) => ids.has(c.id)), payments, userId);
        if (isGroupTooLarge(snap)) throw new Error('too-large');
        synced.current.set(groupId, JSON.stringify(snap));
        try {
          await setDoc(doc(db, GROUP_COLLECTION, groupId), { ...snap, updatedAt: serverTimestamp() });
          await setDoc(doc(db, 'users', userId, 'share_groups', groupId), {
            title: snap.title,
            memberIds: customerIds,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          synced.current.delete(groupId);
          deleteDoc(doc(db, GROUP_COLLECTION, groupId)).catch(() => {});
          throw err;
        }
      })();
      return { url, ready };
    },
    [userId, customers, payments]
  );

  // Revoke: remove registry entry FIRST so the sync effect can't recreate the public copy
  const revokeGroup = useCallback(
    async (group) => {
      await deleteDoc(doc(db, 'users', userId, 'share_groups', group.id));
      synced.current.delete(group.id);
      await deleteDoc(doc(db, GROUP_COLLECTION, group.id));
    },
    [userId]
  );

  return { groups, createGroupLink, revokeGroup };
}
