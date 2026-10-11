import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SHARE_COLLECTION, isValidShareId } from '../utils/passbook';

/**
 * Guest-side: subscribes to ONE public passbook document. No auth needed.
 * Live — if the store owner records a payment, the open page updates itself.
 */
export function usePublicPassbook(shareId) {
  const [state, setState] = useState({ loading: Boolean(shareId), data: null, error: null });

  useEffect(() => {
    if (!shareId) return undefined;

    if (!isValidShareId(shareId)) {
      setState({ loading: false, data: null, error: 'not-found' });
      return undefined;
    }

    setState({ loading: true, data: null, error: null });
    return onSnapshot(
      doc(db, SHARE_COLLECTION, shareId),
      (snap) =>
        setState(
          snap.exists()
            ? { loading: false, data: snap.data(), error: null }
            : { loading: false, data: null, error: 'not-found' }
        ),
      () => setState({ loading: false, data: null, error: 'unavailable' })
    );
  }, [shareId]);

  return state;
}
