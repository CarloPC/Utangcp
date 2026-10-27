import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { extFor, randomName, removeStoredFile, uploadPublicFile } from '../utils/gcash';

/**
 * Owner-side GCash settings, stored privately at
 *   users/{uid}/settings/payment
 * `payInfo` is the PUBLIC subset that gets copied into each shared passbook.
 */
export function usePaymentSettings(userId) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setSettings(null);
      setLoading(false);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'users', userId, 'settings', 'payment'),
      (snap) => {
        setSettings(snap.exists() ? snap.data() : {});
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [userId]);

  const payInfo = useMemo(() => {
    if (!settings?.gcash_qr_url) return null;
    return {
      gcash_qr_url: settings.gcash_qr_url,
      gcash_name: settings.gcash_name || '',
      gcash_number: settings.gcash_number || '',
    };
  }, [settings]);

  // file: optional new QR image. name/number: optional text.
  const saveSettings = useCallback(
    async ({ file, name, number }) => {
      const data = {
        gcash_name: (name || '').trim(),
        gcash_number: (number || '').trim(),
        updatedAt: serverTimestamp(),
      };
      let oldPath = null;
      if (file) {
        const { url, path } = await uploadPublicFile(
          `${userId}/gcash-qr-${randomName()}.${extFor(file)}`,
          file
        );
        oldPath = settings?.gcash_qr_path;
        data.gcash_qr_url = url;
        data.gcash_qr_path = path;
      }
      await setDoc(doc(db, 'users', userId, 'settings', 'payment'), data, { merge: true });
      if (oldPath) removeStoredFile(oldPath);
    },
    [userId, settings]
  );

  const removeQr = useCallback(async () => {
    const oldPath = settings?.gcash_qr_path;
    await setDoc(
      doc(db, 'users', userId, 'settings', 'payment'),
      { gcash_qr_url: null, gcash_qr_path: null, updatedAt: serverTimestamp() },
      { merge: true }
    );
    removeStoredFile(oldPath);
  }, [userId, settings]);

  return { settings, payInfo, loading, saveSettings, removeQr };
}
