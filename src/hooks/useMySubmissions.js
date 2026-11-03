import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, limit, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { SUBMISSIONS } from './usePaymentSubmissions';
import { compressImage, extFor, randomName, uploadPublicFile } from '../utils/gcash';

const tsMillis = (s) => s.createdAt?.toMillis?.() ?? Date.now(); // just-sent docs have no server time yet

/**
 * Customer-side (no login). Uploads the receipt, creates the
 * `payment_submissions` doc with status "pending", and live-loads every
 * submission for this customer from Firestore (not from this browser), so the
 * Pending / Approved / Rejected list is the same on any device or browser
 * that opens the link.
 */
export function useMySubmissions({ shareId, groupId }, passbook) {
  const token = shareId || groupId; // the link token (individual or bulk)
  const creditId = passbook.creditId;
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!token || !creditId) return undefined;
    const q = query(
      collection(db, SUBMISSIONS),
      where(shareId ? 'shareId' : 'groupId', '==', token),
      where('creditId', '==', creditId),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => tsMillis(b) - tsMillis(a));
        setSubmissions(rows);
      },
      () => {}
    );
    return unsub;
  }, [shareId, token, creditId]);

  const submit = useCallback(
    async ({ amount, file }) => {
      const blob = await compressImage(file);
      const { url, path } = await uploadPublicFile(
        `receipts/${token}/${randomName()}.${extFor(blob)}`,
        blob
      );
      const ref = await addDoc(collection(db, SUBMISSIONS), {
        ownerId: passbook.ownerId,
        ...(shareId ? { shareId } : { groupId }),
        creditId: passbook.creditId,
        customerName: `${passbook.firstname} ${passbook.lastname}`.trim().slice(0, 120),
        productName: (passbook.product_name || '').slice(0, 120),
        amount: Number(amount),
        receiptUrl: url,
        receiptPath: path,
        status: 'pending', // shown to the owner as "Pending Review"
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [shareId, groupId, token, passbook]
  );

  return { submissions, submit };
}
