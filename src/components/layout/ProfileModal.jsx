import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../shared/Avatar';
import { validateImageFile } from '../../utils/gcash';
import styles from './ProfileModal.module.css';

/**
 * Owner profile editor. The name + photo saved here are what customers see
 * at the top of the chat, so they can verify who they are talking to.
 */
export default function ProfileModal({ user, profile, onSave, onClose }) {
  const [name, setName] = useState(profile?.displayName || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  const shownPhoto = preview || (removePhoto ? null : profile?.photo_url || null);
  const shownName = name.trim() || user?.email || '';
  const dirty =
    Boolean(file) || removePhoto || name.trim() !== (profile?.displayName || '').trim();

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problem = validateImageFile(f);
    if (problem) return setError(problem);
    setError('');
    setRemovePhoto(false);
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ displayName: name, file, removePhoto });
      onClose();
    } catch (err) {
      setError(err?.message?.length < 120 ? err.message : 'Could not save your profile. Please try again.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={() => !saving && onClose()}>
      <form
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className={styles.head}>
          <h2>Edit profile</h2>
          <button type="button" className={styles.close} onClick={onClose} disabled={saving} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.photoBlock}>
          <button
            type="button"
            className={styles.photoBtn}
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile picture"
          >
            <Avatar url={shownPhoto} name={shownName} size={104} />
            <span className={styles.camera} aria-hidden="true">📷</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
          <div className={styles.photoActions}>
            <button type="button" className={styles.linkBtn} onClick={() => fileRef.current?.click()}>
              {shownPhoto ? 'Change photo' : 'Add photo'}
            </button>
            {shownPhoto && (
              <button
                type="button"
                className={`${styles.linkBtn} ${styles.danger}`}
                onClick={() => {
                  setFile(null);
                  setRemovePhoto(true);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <label className={styles.field}>
          <span>Display name</span>
          <input
            type="text"
            value={name}
            maxLength={60}
            placeholder="e.g. Carlo Canezares"
            onChange={(e) => setName(e.target.value)}
          />
          <small>Customers see this name and photo at the top of your chat.</small>
        </label>

        <label className={styles.field}>
          <span>Email</span>
          <input type="text" value={user?.email || ''} readOnly disabled />
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={styles.save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
