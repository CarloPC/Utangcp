import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { compressAvatar } from '../utils/avatar';
import { extFor, randomName, removeStoredFile, uploadPublicFile, validateImageFile } from '../utils/gcash';

/**
 * Owner profile, stored privately at users/{uid}/settings/profile.
 * `publicProfile` is the small subset copied into every shared passbook so
 * customers can see who they are chatting with.
 */
export function useOwnerProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'users', userId, 'settings', 'profile'),
      (snap) => {
        setProfile(snap.exists() ? snap.data() : {});
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [userId]);

  const publicProfile = useMemo(() => {
    const name = (profile?.displayName || '').trim();
    const photo = profile?.photo_url || null;
    if (!name && !photo) return null;
    return { name, photo_url: photo };
  }, [profile]);

  // file: new photo (optional) · removePhoto: delete the current one
  const saveProfile = useCallback(
    async ({ displayName, file, removePhoto }) => {
      const data = { displayName: (displayName || '').trim().slice(0, 60), updatedAt: serverTimestamp() };
      let oldPath = null;
      if (file) {
        const problem = validateImageFile(file);
        if (problem) throw new Error(problem);
        const blob = await compressAvatar(file);
        const up = await uploadPublicFile(`${userId}/profile-${randomName()}.${extFor(blob)}`, blob);
        oldPath = profile?.photo_path;
        data.photo_url = up.url;
        data.photo_path = up.path;
      } else if (removePhoto) {
        oldPath = profile?.photo_path;
        data.photo_url = null;
        data.photo_path = null;
      }
      await setDoc(doc(db, 'users', userId, 'settings', 'profile'), data, { merge: true });
      if (oldPath) removeStoredFile(oldPath);
    },
    [userId, profile]
  );

  return { profile, publicProfile, loading, saveProfile };
}
