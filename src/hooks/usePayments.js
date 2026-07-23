import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export function usePayments(userId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users', userId, 'payment_history'),
      orderBy('payment_date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  const addPayment = useCallback(
    async (creditId, amount, paymentDate) => {
      const amt = Number(amount);
      const batch = writeBatch(db);

      // Insert payment record
      const payRef = doc(collection(db, 'users', userId, 'payment_history'));
      batch.set(payRef, {
        credit_id: creditId,
        amount: amt,
        payment_date: paymentDate,
        createdAt: serverTimestamp(),
      });

      // Update credit totals
      const creditRef = doc(db, 'users', userId, 'credits', creditId);
      const creditSnap = await getDoc(creditRef);
      const credit = creditSnap.data();
      const newPaid = (credit.paid || 0) + amt;
      const newBalance = credit.price - newPaid;
      batch.update(creditRef, { paid: newPaid, remaining_balance: newBalance });

      await batch.commit();
    },
    [userId]
  );

  const deletePayment = useCallback(
    async (paymentId, creditId, amount) => {
      const amt = Number(amount);
      const batch = writeBatch(db);

      batch.delete(doc(db, 'users', userId, 'payment_history', paymentId));

      const creditRef = doc(db, 'users', userId, 'credits', creditId);
      const creditSnap = await getDoc(creditRef);
      const credit = creditSnap.data();
      const newPaid = Math.max(0, (credit.paid || 0) - amt);
      const newBalance = credit.price - newPaid;
      batch.update(creditRef, { paid: newPaid, remaining_balance: newBalance });

      await batch.commit();
    },
    [userId]
  );

  const updatePayment = useCallback(
    async (paymentId, creditId, newAmount, newDate, oldAmount) => {
      const newAmt = Number(newAmount);
      const oldAmt = Number(oldAmount);
      const diff = newAmt - oldAmt;
      const batch = writeBatch(db);

      batch.update(doc(db, 'users', userId, 'payment_history', paymentId), {
        amount: newAmt,
        payment_date: newDate,
      });

      const creditRef = doc(db, 'users', userId, 'credits', creditId);
      const creditSnap = await getDoc(creditRef);
      const credit = creditSnap.data();
      const newPaid = (credit.paid || 0) + diff;
      const newBalance = credit.price - newPaid;
      batch.update(creditRef, { paid: newPaid, remaining_balance: newBalance });

      await batch.commit();
    },
    [userId]
  );

  return { payments, loading, addPayment, deletePayment, updatePayment };
}
