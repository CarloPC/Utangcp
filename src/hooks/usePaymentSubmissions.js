import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { removeStoredFile } from '../utils/gcash';

export const SUBMISSIONS = 'payment_submissions';

/**
 * Owner-side: live list of GCash receipts customers submitted.
 *  approve() -> records a real payment (via addPayment) then marks it approved
 *  reject()  -> marks it rejected with an optional reason the customer sees
 */
export function usePaymentSubmissions(userId, addPayment) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return undefined;
    }
    // Single equality filter -> no composite index needed; sorted client-side.
    const q = query(collection(db, SUBMISSIONS), where('ownerId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setItems(rows);
      },
      () => setItems([])
    );
  }, [userId]);

  const pending = useMemo(() => items.filter((s) => s.status === 'pending'), [items]);
  const reviewed = useMemo(() => items.filter((s) => s.status !== 'pending'), [items]);

  const approve = useCallback(
    async (sub, amount, paymentDate) => {
      const amt = Number(amount);
      if (!(amt > 0)) throw new Error('Invalid amount');
      await addPayment(sub.creditId, amt, paymentDate); // updates balance + history
      await updateDoc(doc(db, SUBMISSIONS, sub.id), {
        status: 'approved',
        approvedAmount: amt,
        reviewedAt: serverTimestamp(),
      });
    },
    [addPayment]
  );

  const reject = useCallback(async (sub, reason) => {
    await updateDoc(doc(db, SUBMISSIONS, sub.id), {
      status: 'rejected',
      rejectReason: (reason || '').trim().slice(0, 200),
      reviewedAt: serverTimestamp(),
    });
  }, []);

  const remove = useCallback(async (sub) => {
    await deleteDoc(doc(db, SUBMISSIONS, sub.id));
    removeStoredFile(sub.receiptPath);
  }, []);

  return { items, pending, reviewed, approve, reject, remove };
}
