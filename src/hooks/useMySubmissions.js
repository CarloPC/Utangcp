import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { SUBMISSIONS } from './usePaymentSubmissions';
import { compressImage, extFor, randomName, uploadPublicFile } from '../utils/gcash';

const storeKey = (shareId) => `utangcp:submissions:${shareId}`;

function readIds(shareId) {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(shareId)) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20) : [];
  } catch {
    return [];
  }
}

/**
 * Customer-side (no login). Uploads the receipt, creates the
 * `payment_submissions` doc with status "pending", and remembers its id in
 * this browser so the customer can watch it go Pending -> Approved/Rejected.
 */
export function useMySubmissions({ shareId, groupId }, passbook) {
  const token = shareId || groupId; // the link token (individual or bulk)
  const [ids, setIds] = useState(() => readIds(token));
  const [byId, setById] = useState({});

  const idsKey = ids.join(',');
  useEffect(() => {
    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, SUBMISSIONS, id),
        (snap) => {
          if (snap.exists()) setById((m) => ({ ...m, [id]: { id, ...snap.data() } }));
        },
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const submit = useCallback(
    async ({ amount, referenceNo, file }) => {
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
        referenceNo: referenceNo.trim(),
        receiptUrl: url,
        receiptPath: path,
        status: 'pending', // shown to the owner as "Pending Review"
        createdAt: serverTimestamp(),
      });
      const next = [ref.id, ...readIds(token)].slice(0, 20);
      try {
        localStorage.setItem(storeKey(token), JSON.stringify(next));
      } catch {
        /* private mode: status tracking just won't persist */
      }
      setIds(next);
      return ref.id;
    },
    [shareId, groupId, token, passbook]
  );

  // A bulk link holds many customers: only show this customer's own receipts
  const mine = ids.map((id) => byId[id]).filter((s) => s && s.creditId === passbook.creditId);
  return { submissions: mine, submit };
}
