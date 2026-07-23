import { useState, useRef, useEffect } from 'react';
import Alert from '../shared/Alert';
import { today } from '../../utils/format';
import styles from './AddCustomer.module.css';

const EMPTY = {
  firstname: '',
  lastname: '',
  mobile_number: '',
  product_name: '',
  price: '',
  paid: '',
  date: today(),
};

const MAX_PHOTO_MB = 5;

export default function AddCustomer({ onAdd, onAddPayment, onUploadPhoto }) {
  const [form, setForm] = useState(EMPTY);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const remaining = (Number(form.price) || 0) - (Number(form.paid) || 0);

  // Clean up the object URL when it's replaced or the component unmounts
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAlert({ type: 'error', message: 'Please choose an image file.' });
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setAlert({ type: 'error', message: `Photo must be smaller than ${MAX_PHOTO_MB}MB.` });
      e.target.value = '';
      return;
    }

    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = [];
    if (!form.firstname || !String(form.firstname).trim()) errs.push('First name is required.');
    if (!form.lastname || !String(form.lastname).trim()) errs.push('Last name is required.');
    if (!form.product_name || !String(form.product_name).trim()) errs.push('Product name is required.');
    if (form.price === '' || form.price === null || Number.isNaN(Number(form.price))) errs.push('Total price is required.');
    if (form.paid === '' || form.paid === null || Number.isNaN(Number(form.paid))) errs.push('Amount paid is required.');
    if (errs.length > 0) {
      setAlert({ type: 'error', message: errs.join(' ') });
      return;
    }
    if (Number(form.paid) > Number(form.price)) {
      setAlert({ type: 'error', message: 'Amount Paid cannot exceed Total Price.' });
      return;
    }
    setLoading(true);
    try {
      let photo_url = null;
      let photo_path = null;

      if (photoFile) {
        try {
          const uploaded = await onUploadPhoto(photoFile);
          photo_url = uploaded?.url || null;
          photo_path = uploaded?.path || null;
        } catch (photoErr) {
          console.error('Photo upload error:', photoErr);
          setAlert({ type: 'error', message: 'Customer was not saved: photo upload failed. Please try again.' });
          setLoading(false);
          return;
        }
      }

      const docRef = await onAdd({
        ...form,
        price: Number(form.price),
        paid: Number(form.paid),
        photo_url,
        photo_path,
      });

      if (Number(form.paid) > 0 && docRef?.id) {
        await onAddPayment(docRef.id, form.paid, form.date);
      }

      setAlert({ type: 'success', message: 'New customer record added successfully!' });
      setForm({ ...EMPTY, date: today() });
      handleRemovePhoto();
    } catch {
      setAlert({ type: 'error', message: 'Failed to add customer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Add New Customer Record</h2>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <div className={styles.formCard}>
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.group}>
            <label className="label" htmlFor="photo">Customer Photo (Optional)</label>
            <div className={styles.photoRow}>
              {photoPreview ? (
                <img src={photoPreview} alt="Customer preview" className={styles.photoPreview} />
              ) : (
                <div className={styles.photoPlaceholder}>No photo</div>
              )}
              <div className={styles.photoActions}>
                <input
                  ref={fileInputRef}
                  id="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className={styles.photoInput}
                />
                {photoFile && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleRemovePhoto}
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.group}>
              <label className="label" htmlFor="firstname">First Name</label>
              <input className="input" id="firstname" name="firstname" required
                value={form.firstname} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label" htmlFor="lastname">Last Name</label>
              <input className="input" id="lastname" name="lastname" required
                value={form.lastname} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label" htmlFor="mobile_number">Mobile Number (Optional)</label>
              <input className="input" id="mobile_number" name="mobile_number"
                type="tel" placeholder="e.g., 09123456789"
                value={form.mobile_number} onChange={handleChange} />
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.group}>
              <label className="label" htmlFor="price">Total Price (₱)</label>
              <input className="input" id="price" name="price" type="number"
                min="0" required placeholder="0"
                value={form.price} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label" htmlFor="paid">Amount Paid (₱)</label>
              <input className="input" id="paid" name="paid" type="number"
                min="0" required placeholder="0"
                value={form.paid} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label" htmlFor="remaining">Remaining Balance (₱)</label>
              <input className="input" id="remaining" readOnly
                value={form.price !== '' || form.paid !== '' ? remaining : ''}
                tabIndex={-1} />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.group}>
              <label className="label" htmlFor="date">Date</label>
              <input className="input" id="date" name="date" type="date" required
                value={form.date} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label" htmlFor="product_name">Product Name</label>
              <input className="input" id="product_name" name="product_name" required
                placeholder="e.g., Rice, Oil, etc."
                value={form.product_name} onChange={handleChange} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Adding…' : 'Add Customer Record'}
          </button>
        </form>
      </div>
    </div>
  );
}