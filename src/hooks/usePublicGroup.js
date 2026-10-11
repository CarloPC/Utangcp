import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { GROUP_COLLECTION, isValidShareId } from '../utils/passbook';

/** Guest-side, live subscription to ONE public shared list. No auth needed. */
export function usePublicGroup(groupId) {
  const [state, setState] = useState({ loading: Boolean(groupId), data: null, error: null });

  useEffect(() => {
    if (!groupId) return undefined;
    if (!isValidShareId(groupId)) {
      setState({ loading: false, data: null, error: 'not-found' });
      return undefined;
    }
    setState({ loading: true, data: null, error: null });
    return onSnapshot(
      doc(db, GROUP_COLLECTION, groupId),
      (snap) =>
        setState(
          snap.exists()
            ? { loading: false, data: snap.data(), error: null }
            : { loading: false, data: null, error: 'not-found' }
        ),
      () => setState({ loading: false, data: null, error: 'unavailable' })
    );
  }, [groupId]);

  return state;
}
