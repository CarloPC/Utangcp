import { useState, useMemo } from 'react';
import Alert from '../shared/Alert';
import ConfirmModal from '../shared/ConfirmModal';
import { formatCurrency, formatDate, today } from '../../utils/format';
import { markRecentlyPaid, unmarkRecentlyPaid } from '../../utils/recentlyPaid';
import styles from './PaymentHistory.module.css';

// Ã¢â€â‚¬Ã¢â€â‚¬ Edit Payment Modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function EditPaymentModal({ payment, customers, onSave, onClose }) {
  const customer = customers.find((c) => c.id === payment.credit_id);
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.payment_date);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(payment.id, payment.credit_id, amount, date, payment.amount);
      onClose();
    } catch {
      /* handled by parent */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className={styles.modalHeader}>
          <h3>Edit Payment</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">Ã¢Å“â€¢</button>
        </div>

        {customer && (
          <div className={styles.customerInfo}>
            <p><strong>Customer:</strong> {customer.firstname} {customer.lastname}</p>
            <p><strong>Product:</strong> {customer.product_name}</p>
            <p><strong>Original Amount:</strong> {formatCurrency(payment.amount)}</p>
            <p><strong>Original Date:</strong> {formatDate(payment.payment_date)}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.editForm}>
          <div className={styles.group}>
            <label className="label">New Payment Amount </label>
            <input className="input" type="number" min="1" required
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className={styles.group}>
            <label className="label">New Payment Date</label>
            <input className="input" type="date" required
              value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Saving' : 'Update Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Main Component Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export default function PaymentHistory({ customers, payments, onAdd, onUpdate, onDelete }) {
  const [form, setForm] = useState({ credit_id: '', amount: '', payment_date: today() });
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [alert, setAlert] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Outstanding customers (for the add form dropdown)
  const outstandingCustomers = useMemo(
    () => customers.filter((c) => c.remaining_balance > 0),
    [customers]
  );

  const filteredDropdown = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return outstandingCustomers.filter(
      (c) =>
        !q ||
        (c.firstname + ' ' + c.lastname + ' ' + (c.product_name || '')).toLowerCase().includes(q)
    );
  }, [outstandingCustomers, customerSearch]);

  // Build enriched payments (join customer info)
  const enriched = useMemo(() => {
    return payments.map((p) => {
      const c = customers.find((c) => c.id === p.credit_id);
      return { ...p, customer: c };
    });
  }, [payments, customers]);

  // Filter payments
  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      if (!p.customer) return false;
      const nameMatch =
        !searchName ||
        (p.customer.firstname + ' ' + p.customer.lastname + ' ' + (p.customer.product_name || ''))
          .toLowerCase()
          .includes(searchName.toLowerCase());
      const dateMatch = !searchDate || p.payment_date === searchDate;
      return nameMatch && dateMatch;
    });
  }, [enriched, searchName, searchDate]);

  const outstandingPayments = filtered.filter((p) => p.customer?.remaining_balance > 0);
  const paidPayments = filtered.filter((p) => p.customer?.remaining_balance <= 0);

  // Search totals (from daily.php feature)
  const searchTotal = useMemo(() => {
    if (!searchDate && !searchName) return null;
    const subset = searchDate && !searchName
      ? payments.filter((p) => p.payment_date === searchDate)
      : searchName && !searchDate
        ? payments.filter((p) => {
            const c = customers.find((c) => c.id === p.credit_id);
            if (!c) return false;
            return (c.firstname + ' ' + c.lastname + ' ' + (c.product_name || ''))
              .toLowerCase()
              .includes(searchName.toLowerCase());
          })
        : filtered;
    const total = subset.reduce((s, p) => s + (p.amount || 0), 0);
    return total;
  }, [payments, customers, searchName, searchDate, filtered]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.credit_id) return;
    setAddLoading(true);
    try {
      await onAdd(form.credit_id, form.amount, form.payment_date);
      // Only tag as "paid this session" if the payment is for today â€”
      // Bulk Add's green label is specifically about today's payments.
      if (form.payment_date === today()) {
        markRecentlyPaid(form.credit_id);
      }
      setAlert({ type: 'success', message: 'Payment recorded successfully!' });
      setForm({ credit_id: '', amount: '', payment_date: today() });
      setCustomerSearch('');
    } catch {
      setAlert({ type: 'error', message: 'Failed to add payment.' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdatePayment = async (paymentId, creditId, newAmount, newDate, oldAmount) => {
    try {
      await onUpdate(paymentId, creditId, newAmount, newDate, oldAmount);
      setAlert({ type: 'success', message: 'Payment updated successfully!' });
    } catch {
      setAlert({ type: 'error', message: 'Failed to update payment.' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.id, deleteTarget.credit_id, deleteTarget.amount);

      // If the deleted payment was dated today, clear the customer's
      // "paid this session" flag — but only if they have no other
      // payment left that's also dated today.
      if (deleteTarget.payment_date === today()) {
        const stillPaidToday = payments.some(
          (p) =>
            p.credit_id === deleteTarget.credit_id &&
            p.id !== deleteTarget.id &&
            p.payment_date === today()
        );
        if (!stillPaidToday) {
          unmarkRecentlyPaid(deleteTarget.credit_id);
        }
      }

      setAlert({ type: 'success', message: 'Payment deleted successfully!' });
    } catch {
      setAlert({ type: 'error', message: 'Failed to delete payment.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSearchReset = () => {
    setSearchName('');
    setSearchDate('');
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Payment History</h2>

      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      {/* Add Payment Form */}
      <div className={styles.formCard}>
        <h3 className={styles.formTitle}>Add Payment</h3>
        <form onSubmit={handleAdd}>
          <div className={styles.grid}>
            <div className={styles.group}>
              <label className="label">Select Customer</label>
              <input
                className="input"
                placeholder="Type to search customer"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <select
                className="input"
                value={form.credit_id}
                onChange={(e) => setForm((p) => ({ ...p, credit_id: e.target.value }))}
                required
              >
                <option value="">-- Select --</option>
                {filteredDropdown.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstname} {c.lastname}{c.product_name ? ` (${c.product_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.group}>
              <label className="label">Payment Amount </label>
              <input
                className="input"
                type="number"
                min="1"
                required
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>

            <div className={styles.group}>
              <label className="label">Payment Date</label>
              <input
                className="input"
                type="date"
                required
                value={form.payment_date}
                onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-success" disabled={addLoading}>
            {addLoading ? 'Adding' : 'Add Payment'}
          </button>
        </form>
      </div>

      {/* Search */}
      <div className={styles.searchCard}>
        <div className={styles.searchGrid}>
          <div className={styles.group}>
            <label className="label">Search by Customer or Product</label>
            <input
              className="input"
              placeholder="Enter name or product"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          <div className={styles.group}>
            <label className="label">Search by Payment Date</label>
            <input
              className="input"
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
            />
          </div>
          {(searchName || searchDate) && (
            <div className={styles.group} style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={handleSearchReset} style={{ marginTop: 28 }}>
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Total Summary (daily.php feature) */}
        {searchTotal !== null && (
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>
              Total Payments
              {searchDate ? ` for ${formatDate(searchDate)}` : ''}
              {searchName ? ` for "${searchName}"` : ''}:
            </span>
            <span className={styles.totalAmt}>{formatCurrency(searchTotal)}</span>
          </div>
        )}
      </div>

      {/* Outstanding Payments Table */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Payment History Outstanding Customers</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {outstandingPayments.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>No payment history yet.</td></tr>
              ) : (
                outstandingPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.customer?.firstname} {p.customer?.lastname}</td>
                    <td>{p.customer?.product_name}</td>
                    <td className={styles.amt}>{formatCurrency(p.amount)}</td>
                    <td>{formatDate(p.payment_date)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className="btn btn-warning btn-sm" onClick={() => setEditTarget(p)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fully Paid Payments Table */}
      {paidPayments.length > 0 && (
        <div className={styles.section}>
          <h3 className={`${styles.sectionTitle} ${styles.paidTitle}`}>
            Payment History  Fully Paid Customers
          </h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paidPayments.map((p) => (
                  <tr key={p.id} className={styles.paidRow}>
                    <td>{p.customer?.firstname} {p.customer?.lastname}</td>
                    <td>{p.customer?.product_name}</td>
                    <td className={styles.amt}>{formatCurrency(p.amount)}</td>
                    <td>{formatDate(p.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editTarget && (
        <EditPaymentModal
          payment={editTarget}
          customers={customers}
          onSave={handleUpdatePayment}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Payment"
          message={`Delete payment of ${formatCurrency(deleteTarget.amount)} on ${formatDate(deleteTarget.payment_date)}? This cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}