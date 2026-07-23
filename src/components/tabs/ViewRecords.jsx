import { useState, useMemo, useRef, useEffect } from 'react';
import Alert from '../shared/Alert';
import ConfirmModal from '../shared/ConfirmModal';
import CustomerProfileModal from './CustomerProfileModal';
import { formatCurrency, formatDate, today } from '../../utils/format';
import styles from './ViewRecords.module.css';

function initials(customer) {
  const a = customer.firstname?.[0] || '';
  const b = customer.lastname?.[0] || '';
  return (a + b).toUpperCase() || '?';
}

const MAX_PHOTO_MB = 5;

// ── Avatar (used in the table + edit modal) ─────────────────────────────
function Avatar({ customer, size = 40, onClick }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return customer.photo_url ? (
    <img
      src={customer.photo_url}
      alt={`${customer.firstname} ${customer.lastname}`}
      className={styles.avatarImg}
      style={style}
      onClick={onClick}
    />
  ) : (
    <div className={styles.avatarFallback} style={style} onClick={onClick}>
      {initials(customer)}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────
function EditModal({ customer, onSave, onClose, onUploadPhoto, onDeletePhoto }) {
  const [form, setForm] = useState({
    firstname: customer.firstname || '',
    lastname: customer.lastname || '',
    mobile_number: customer.mobile_number || '',
    product_name: customer.product_name || '',
    price: customer.price ?? '',
    paid: customer.paid ?? '',
    date: customer.date || today(),
  });
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const remaining = (Number(form.price) || 0) - (Number(form.paid) || 0);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`Photo must be smaller than ${MAX_PHOTO_MB}MB.`);
      e.target.value = '';
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        paid: Number(form.paid),
      };

      if (photoFile) {
        const uploaded = await onUploadPhoto(photoFile);
        payload.photo_url = uploaded?.url || null;
        payload.photo_path = uploaded?.path || null;
        // Best-effort cleanup of the old file now that the new one is live
        if (customer.photo_path) onDeletePhoto(customer.photo_path);
      }

      await onSave(customer.id, payload);
      onClose();
    } catch {
      setPhotoError('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.editModal} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className={styles.modalHeader}>
          <h3>Edit Customer Record</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.editForm}>
          <div className={styles.group}>
            <label className="label" htmlFor="edit_photo">Customer Photo (Optional)</label>
            <div className={styles.photoRow}>
              {photoPreview ? (
                <img src={photoPreview} alt="New preview" className={styles.avatarImg} style={{ width: 56, height: 56 }} />
              ) : (
                <Avatar customer={customer} size={56} />
              )}
              <div className={styles.photoActions}>
                <input
                  ref={fileInputRef}
                  id="edit_photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
                {photoError && <span className={styles.photoError}>{photoError}</span>}
              </div>
            </div>
          </div>

          <div className={styles.editGrid}>
            <div className={styles.group}>
              <label className="label">First Name</label>
              <input className="input" name="firstname" required value={form.firstname} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label">Last Name</label>
              <input className="input" name="lastname" required value={form.lastname} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label">Mobile (Optional)</label>
              <input className="input" name="mobile_number" type="tel" value={form.mobile_number} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label">Product Name</label>
              <input className="input" name="product_name" required value={form.product_name} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label">Total Price (₱)</label>
              <input className="input" name="price" type="number" min="0" required value={form.price} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label">Amount Paid (₱)</label>
              <input className="input" name="paid" type="number" min="0" required value={form.paid} onChange={handleChange} />
            </div>
            <div className={styles.group}>
              <label className="label">Remaining Balance (₱)</label>
              <input className="input" readOnly value={form.price !== '' || form.paid !== '' ? remaining : ''} tabIndex={-1} />
            </div>
            <div className={styles.group}>
              <label className="label">Date</label>
              <input className="input" name="date" type="date" required value={form.date} onChange={handleChange} />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Payment History Panel ──────────────────────────────────────────────
function PaymentPanel({ payments }) {
  if (!payments.length) {
    return <p className={styles.noPayments}>No payment history.</p>;
  }
  return (
    <ul className={styles.paymentList}>
      {payments.map((p) => (
        <li key={p.id} className={styles.paymentItem}>
          <span className={styles.payAmt}>{formatCurrency(p.amount)}</span>
          <span className={styles.payDate}>on {formatDate(p.payment_date)}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Customer Row ────────────────────────────────────────────────────────
function CustomerRow({ customer, payments, onEdit, onDelete, onViewProfile }) {
  const [showHistory, setShowHistory] = useState(false);

  const customerPayments = useMemo(
    () => payments.filter((p) => p.credit_id === customer.id),
    [payments, customer.id]
  );

  return (
    <>
      <tr className={styles.row}>
        <td>
          <Avatar customer={customer} onClick={() => onViewProfile(customer)} />
        </td>
        <td>
          <button
            type="button"
            className={styles.nameLink}
            onClick={() => onViewProfile(customer)}
          >
            {customer.firstname} {customer.lastname}
          </button>
        </td>
        <td>{customer.mobile_number
          ? customer.mobile_number
          : <span className={styles.muted}>Not provided</span>}
        </td>
        <td>{formatCurrency(customer.price)}</td>
        <td>{formatCurrency(customer.paid)}</td>
        <td className={styles.balanceNeg}>{formatCurrency(customer.remaining_balance)}</td>
        <td>{formatDate(customer.date)}</td>
        <td>{customer.product_name}</td>
        <td>
          <div className={styles.actions}>
            <button className="btn btn-warning btn-sm" onClick={() => onEdit(customer)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(customer)}>Delete</button>
          </div>
          <button
            className={`btn btn-sm ${styles.historyToggle}`}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
          {showHistory && (
            <div className={styles.historyPanel}>
              <strong className={styles.historyTitle}>Payment History:</strong>
              <PaymentPanel payments={customerPayments} />
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────
export default function ViewRecords({ customers, payments, onUpdate, onDelete, onUploadPhoto, onDeletePhoto }) {
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [alert, setAlert] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const outstanding = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.remaining_balance > 0 &&
        (!q ||
          c.firstname?.toLowerCase().includes(q) ||
          c.lastname?.toLowerCase().includes(q) ||
          c.mobile_number?.toLowerCase().includes(q) ||
          c.product_name?.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const fullyPaid = useMemo(
    () => customers.filter((c) => c.remaining_balance <= 0),
    [customers]
  );

  const profilePayments = useMemo(
    () => (profileTarget ? payments.filter((p) => p.credit_id === profileTarget.id) : []),
    [payments, profileTarget]
  );

  const handleSave = async (id, data) => {
    try {
      await onUpdate(id, data);
      setAlert({ type: 'success', message: 'Customer record updated successfully!' });
    } catch {
      setAlert({ type: 'error', message: 'Failed to update record.' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.id);
      if (deleteTarget.photo_path) onDeletePhoto(deleteTarget.photo_path);
      setAlert({ type: 'success', message: 'Record deleted successfully!' });
    } catch {
      setAlert({ type: 'error', message: 'Failed to delete record.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Customer Records</h2>

      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      {/* Search */}
      <div className={styles.searchBar}>
        <input
          className="input"
          placeholder="Search by name, product, or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>Reset</button>
        )}
      </div>

      {/* Outstanding Table */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Outstanding Customers</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Total Price</th>
                <th>Amount Paid</th>
                <th>Remaining</th>
                <th>Date</th>
                <th>Product</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.length === 0 ? (
                <tr><td colSpan={9} className={styles.empty}>No records found</td></tr>
              ) : (
                outstanding.map((c) => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    payments={payments}
                    onEdit={setEditTarget}
                    onDelete={setDeleteTarget}
                    onViewProfile={setProfileTarget}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fully Paid Table */}
      {fullyPaid.length > 0 && (
        <div className={styles.section}>
          <h3 className={`${styles.sectionTitle} ${styles.paidTitle}`}>Fully Paid Customers</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Total Price</th>
                  <th>Amount Paid</th>
                  <th>Remaining</th>
                  <th>Date</th>
                  <th>Product</th>
                </tr>
              </thead>
              <tbody>
                {fullyPaid.map((c) => (
                  <tr key={c.id} className={styles.paidRow}>
                    <td>
                      <Avatar customer={c} onClick={() => setProfileTarget(c)} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.nameLink}
                        onClick={() => setProfileTarget(c)}
                      >
                        {c.firstname} {c.lastname}
                      </button>
                    </td>
                    <td>{c.mobile_number || <span className={styles.muted}>Not provided</span>}</td>
                    <td>{formatCurrency(c.price)}</td>
                    <td>{formatCurrency(c.paid)}</td>
                    <td className={styles.balancePos}>{formatCurrency(c.remaining_balance)}</td>
                    <td>{formatDate(c.date)}</td>
                    <td>{c.product_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {profileTarget && (
        <CustomerProfileModal
          customer={profileTarget}
          payments={profilePayments}
          onClose={() => setProfileTarget(null)}
          onEdit={setEditTarget}
        />
      )}

      {editTarget && (
        <EditModal
          customer={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
          onUploadPhoto={onUploadPhoto}
          onDeletePhoto={onDeletePhoto}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Record"
          message={`Delete "${deleteTarget.firstname} ${deleteTarget.lastname}" (${deleteTarget.product_name})? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}