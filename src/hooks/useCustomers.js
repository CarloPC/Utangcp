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
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { supabase } from '../supabase';

// Supabase Storage bucket used for customer photos
const PHOTO_BUCKET = 'Utangcp';

export function useCustomers(userId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users', userId, 'credits'),
      orderBy('firstname', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  // Upload a customer photo to Supabase Storage.
  // Returns { url, path } on success, or throws on failure.
  const uploadCustomerPhoto = useCallback(
    async (file) => {
      if (!file) return null;
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, path };
    },
    [userId]
  );

  // Remove a customer photo from Supabase Storage (best-effort; ignores errors).
  const deleteCustomerPhoto = useCallback(async (path) => {
    if (!path) return;
    try {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    } catch {
      // Non-fatal: an orphaned file in storage isn't worth failing the UI over.
    }
  }, []);

  const addCustomer = useCallback(
    async (data) => {
      const price = Number(data.price);
      const paid = Number(data.paid);
      const remaining_balance = price - paid;
      const docRef = await addDoc(collection(db, 'users', userId, 'credits'), {
        firstname: data.firstname,
        lastname: data.lastname,
        mobile_number: data.mobile_number || null,
        product_name: data.product_name,
        price,
        paid,
        remaining_balance,
        date: data.date,
        photo_url: data.photo_url || null,
        photo_path: data.photo_path || null,
        createdAt: serverTimestamp(),
      });
      return docRef;  // ← this is the only change
    },
    [userId]
  );

  const updateCustomer = useCallback(
    async (id, data) => {
      const price = Number(data.price);
      const paid = Number(data.paid);
      const remaining_balance = price - paid;
      const updatePayload = {
        firstname: data.firstname,
        lastname: data.lastname,
        mobile_number: data.mobile_number || null,
        product_name: data.product_name,
        price,
        paid,
        remaining_balance,
        date: data.date,
      };
      // Only touch photo fields when explicitly provided, so a normal
      // detail edit doesn't accidentally wipe out an existing photo.
      if (data.photo_url !== undefined) updatePayload.photo_url = data.photo_url;
      if (data.photo_path !== undefined) updatePayload.photo_path = data.photo_path;

      await updateDoc(doc(db, 'users', userId, 'credits', id), updatePayload);
    },
    [userId]
  );

  const deleteCustomer = useCallback(
    async (id) => {
      const batch = writeBatch(db);
      // Remove related payment history docs
      const paymentsSnap = await getDocs(
        collection(db, 'users', userId, 'payment_history')
      );
      paymentsSnap.docs
        .filter((d) => d.data().credit_id === id)
        .forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'users', userId, 'credits', id));
      await batch.commit();
    },
    [userId]
  );

  return {
    customers,
    loading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    uploadCustomerPhoto,
    deleteCustomerPhoto,
  };
}