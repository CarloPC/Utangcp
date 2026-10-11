import { useCallback, useEffect, useRef } from 'react';
import { doc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  SHARE_COLLECTION,
  buildPassbookSnapshot,
  buildShareUrl,
  newShareId,
} from '../utils/passbook';

/**
 * Owner-side logic for public passbooks.
 *
 * Each shared customer has a sanitized, read-only copy at
 *   shared_passbooks/{shareId}
 * (the customer's `share_id` field points at it). This hook:
 *   - createShareLink(): creates/refreshes that copy and returns the URL
 *   - revokeShare():     deletes the copy, so the link stops working
 *   - keeps every shared copy in sync whenever customers/payments change
 *     (add / edit / delete a payment anywhere in the app -> link updates live)
 */
export function useSharedPassbooks(userId, customers, payments, ready) {
  // shareId -> last JSON written, so we only write when something changed
  const synced = useRef(new Map());

  const paymentsFor = useCallback(
    (creditId) => payments.filter((p) => p.credit_id === creditId),
    [payments]
  );

  // ── Keep public copies up to date ────────────────────────────────
  useEffect(() => {
    if (!userId || !ready) return; // never sync before data has fully loaded
    customers.forEach((c) => {
      if (!c.share_id) return;
      const snap = buildPassbookSnapshot(c, paymentsFor(c.id), userId);
      const key = JSON.stringify(snap);
      if (synced.current.get(c.share_id) === key) return;
      synced.current.set(c.share_id, key);
      setDoc(doc(db, SHARE_COLLECTION, c.share_id), {
        ...snap,
        updatedAt: serverTimestamp(),
      }).catch(() => synced.current.delete(c.share_id)); // retry next change
    });
  }, [userId, ready, customers, paymentsFor]);

  // ── Create (or re-use) a link ────────────────────────────────────
  // Returns { url, ready } synchronously so the caller can start the
  // clipboard write inside the click gesture; `ready` resolves once the
  // public copy exists in Firestore.
  const createShareLink = useCallback(
    (customer) => {
      const existing = customer.share_id;
      const shareId = existing || newShareId();
      const url = buildShareUrl(shareId);

      const ready = (async () => {
        const snap = buildPassbookSnapshot(customer, paymentsFor(customer.id), userId);
        synced.current.set(shareId, JSON.stringify(snap));
        try {
          await setDoc(doc(db, SHARE_COLLECTION, shareId), {
            ...snap,
            updatedAt: serverTimestamp(),
          });
          if (!existing) {
            await updateDoc(doc(db, 'users', userId, 'credits', customer.id), {
              share_id: shareId,
            });
          }
        } catch (err) {
          synced.current.delete(shareId);
          throw err;
        }
      })();

      return { url, ready };
    },
    [userId, paymentsFor]
  );

  // ── Revoke a link ────────────────────────────────────────────────
  const revokeShare = useCallback(
    async (customer) => {
      if (!customer.share_id) return;
      // Detach from the customer FIRST so the sync effect can't re-create it
      await updateDoc(doc(db, 'users', userId, 'credits', customer.id), {
        share_id: deleteField(),
      });
      synced.current.delete(customer.share_id);
      await deleteDoc(doc(db, SHARE_COLLECTION, customer.share_id));
    },
    [userId]
  );

  return { createShareLink, revokeShare };
}
