import { useState, useMemo, useEffect } from 'react';
import Alert from '../shared/Alert';
import ConfirmModal from '../shared/ConfirmModal';
import { formatCurrency, formatDate, today } from '../../utils/format';
import { loadRecentlyPaid, markRecentlyPaid, unmarkRecentlyPaid } from '../../utils/recentlyPaid';
import styles from './PaymentHistory.module.css';

// ── Confetti burst (fires when a customer fully pays off their balance) ──
function ConfettiBurst({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const pieces = useMemo(() => {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7', '#ef4444', '#14b8a6'];
    return Array.from({ length: 70 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        id: i,
        left: fromLeft ? Math.random() * 12 : 88 + Math.random() * 12,
        color: colors[i % colors.length],
        delay: Math.random() * 0.7,
        duration: 2.2 + Math.random() * 1.4,
        rotate: Math.round(Math.random() * 360 + 360),
        size: 6 + Math.random() * 6,
        drift: (fromLeft ? 1 : -1) * (60 + Math.random() * 120),
      };
    });
  }, []);

  return (
    <div className={styles.confettiLayer} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size * 0.42,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

// ── Edit Payment Modal ──
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
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
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

// ── Main Component ──
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

  // Customers marked "paid this session" (today) — shared with Bulk Add.
  const [recentlyPaid, setRecentlyPaid] = useState(() => loadRecentlyPaid());

  // Self-healing check: the "paid this session" flag is set/cleared by
  // hand (mark on add, unmark on delete), which can drift out of sync if
  // a today-dated payment is ever removed some other way. Whenever the
  // live payments list changes, drop any flagged customer who no longer
  // actually has a payment dated today — this is what guarantees the
  // dropdown un-greys itself after a delete.
  useEffect(() => {
    const todayStr = today();
    const idsWithPaymentToday = new Set(
      payments.filter((p) => p.payment_date === todayStr).map((p) => p.credit_id)
    );
    setRecentlyPaid((prev) => {
      const stale = [...prev].filter((id) => !idsWithPaymentToday.has(id));
      if (stale.length === 0) return prev;
      return unmarkRecentlyPaid(stale);
    });
  }, [payments]);

  // Confetti + payoff celebration state
  const [showConfetti, setShowConfetti] = useState(false);

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

  // Whether the Add Payment form's date is currently set to today — the
  // "already paid" dropdown restriction only applies in that case.
  const isAddingForToday = form.payment_date === today();

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

  // When searching by name in the history tables, let the user know if
  // that customer already has a payment recorded today.
  const searchNameMatchesPaidToday = useMemo(() => {
    if (!searchName) return false;
    const q = searchName.toLowerCase();
    return customers.some(
      (c) =>
        recentlyPaid.has(c.id) &&
        (c.firstname + ' ' + c.lastname + ' ' + (c.product_name || '')).toLowerCase().includes(q)
    );
  }, [customers, recentlyPaid, searchName]);

  // Actually perform the payment submission (shared by the normal path
  // and the "add anyway" duplicate-confirmation path).
  const submitPayment = async (creditId, amount, paymentDate) => {
    setAddLoading(true);
    try {
      const customer = customers.find((c) => c.id === creditId);
      const amt = Number(amount);
      const currentBalance = customer?.remaining_balance ?? 0;
      const willFullyPayOff = currentBalance > 0 && amt >= currentBalance;

      await onAdd(creditId, amount, paymentDate);

      // Only tag as "paid this session" if the payment is for today —
      // Bulk Add's green label is specifically about today's payments.
      if (paymentDate === today()) {
        setRecentlyPaid(markRecentlyPaid(creditId));
      }

      if (willFullyPayOff) {
        setShowConfetti(true);
        setAlert({
          type: 'success',
          message: `🎉 ${customer.firstname} ${customer.lastname} just paid off their entire balance!`,
        });
      } else {
        setAlert({ type: 'success', message: 'Payment recorded successfully!' });
      }

      setForm({ credit_id: '', amount: '', payment_date: today() });
      setCustomerSearch('');
    } catch {
      setAlert({ type: 'error', message: 'Failed to add payment.' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.credit_id) return;

    // Duplicate-payment guard: customers already paid today are disabled
    // in the dropdown so they can't be selected in the first place (only
    // when the date is today). This is just a safety net in case the
    // selection slips through some other way (e.g. stale form state).
    if (isAddingForToday && recentlyPaid.has(form.credit_id)) {
      setAlert({
        type: 'error',
        message: 'This customer is already marked "Paid this session" — pick a different customer or a different date.',
      });
      return;
    }

    await submitPayment(form.credit_id, form.amount, form.payment_date);
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
          setRecentlyPaid(unmarkRecentlyPaid(deleteTarget.credit_id));
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

      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}

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
                {filteredDropdown.map((c) => {
                  // Only block selection when adding a payment for TODAY
                  // and this customer already has one. Picking a past date
                  // (e.g. recording yesterday's payment) is always allowed,
                  // even if they're already marked paid for today.
                  const blockedForThisDate = isAddingForToday && recentlyPaid.has(c.id);
                  return (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={blockedForThisDate}
                      className={blockedForThisDate ? styles.optionPaidToday : undefined}
                      style={
                        blockedForThisDate
                          ? { color: '#15803d', backgroundColor: '#f0fdf4', fontStyle: 'italic' }
                          : undefined
                      }
                    >
                      {blockedForThisDate ? '✓ ' : ''}
                      {c.firstname} {c.lastname}{c.product_name ? ` (${c.product_name})` : ''}
                      {blockedForThisDate ? ' — Paid this session' : ''}
                    </option>
                  );
                })}
              </select>

              {isAddingForToday && filteredDropdown.some((c) => recentlyPaid.has(c.id)) && (
                <p className={styles.duplicateWarning}>
                  ✓ Customers already <strong>paid this session</strong> are greyed out and can't
                  be selected here — this avoids duplicate entries for today. To add another
                  payment for one of them anyway, pick a different date first.
                </p>
              )}
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
            {searchNameMatchesPaidToday && (
              <p className={styles.duplicateWarning} style={{ marginTop: 6 }}>
                ✓ This customer is marked <strong>Paid this session</strong> for today.
              </p>
            )}
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
                    <td>
                      {p.customer?.firstname} {p.customer?.lastname}
                      {p.customer && recentlyPaid.has(p.customer.id) && (
                        <span className={styles.paidTag}>✓ Paid this session</span>
                      )}
                    </td>
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