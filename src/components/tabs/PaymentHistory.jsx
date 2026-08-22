import { useState, useMemo, useEffect, useRef } from 'react';
import Alert from '../shared/Alert';
import ConfirmModal from '../shared/ConfirmModal';
import ConfettiBurst from '../shared/ConfettiBurst';
import { formatCurrency, formatDate, today } from '../../utils/format';
import styles from './PaymentHistory.module.css';

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

  // Customers who already have a payment dated today — derived directly
  // from the live (realtime) payments list rather than a hand-maintained
  // flag. This is what makes the "already paid today" block always
  // accurate: adding, editing (e.g. changing a payment's date to today),
  // or deleting a payment all flow straight through `payments` and
  // recompute this instantly, with nothing to fall out of sync.
  const paidTodayIds = useMemo(() => {
    const todayStr = today();
    return new Set(
      payments.filter((p) => p.payment_date === todayStr).map((p) => p.credit_id)
    );
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

  // ── Celebrate settled customers when browsing by date ──
  // Whenever the "Search by Payment Date" field is set (or changed) to a
  // date that has at least one fully-paid/settled customer, fire the
  // confetti burst — this makes it easy to spot at a glance which days
  // had a payoff. Guarded by a ref so it only fires on an actual date
  // change (not on every unrelated re-render / data refresh while the
  // same date stays selected).
  const lastCelebratedDateRef = useRef(null);
  useEffect(() => {
    if (!searchDate) {
      lastCelebratedDateRef.current = null;
      return;
    }
    if (searchDate === lastCelebratedDateRef.current) return;
    lastCelebratedDateRef.current = searchDate;

    const hasSettledOnDate = payments.some((p) => {
      if (p.payment_date !== searchDate) return false;
      const c = customers.find((cust) => cust.id === p.credit_id);
      return c && c.remaining_balance <= 0;
    });
    if (hasSettledOnDate) {
      setShowConfetti(true);
    }
  }, [searchDate, payments, customers]);

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
    const daysPaid = new Set(subset.map((p) => p.payment_date)).size;
    return { total, daysPaid };
  }, [payments, customers, searchName, searchDate, filtered]);

  // When searching by name in the history tables, let the user know if
  // that customer already has a payment recorded today.
  const searchNameMatchesPaidToday = useMemo(() => {
    if (!searchName) return false;
    const q = searchName.toLowerCase();
    return customers.some(
      (c) =>
        paidTodayIds.has(c.id) &&
        (c.firstname + ' ' + c.lastname + ' ' + (c.product_name || '')).toLowerCase().includes(q)
    );
  }, [customers, paidTodayIds, searchName]);

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
    if (isAddingForToday && paidTodayIds.has(form.credit_id)) {
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
                  const blockedForThisDate = isAddingForToday && paidTodayIds.has(c.id);
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

              {isAddingForToday && filteredDropdown.some((c) => paidTodayIds.has(c.id)) && (
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
            <div>
              <span className={styles.totalLabel}>
                Total Payments
                {searchDate ? ` for ${formatDate(searchDate)}` : ''}
                {searchName ? ` for "${searchName}"` : ''}:
              </span>
              <span className={styles.totalAmt}>{formatCurrency(searchTotal.total)}</span>
            </div>
            <div className={styles.daysPaidLine}>
              <span className={styles.totalLabel}>Total Days Paid:</span>
              <span className={styles.totalAmt}>{searchTotal.daysPaid}</span>
            </div>
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
                      {p.customer && paidTodayIds.has(p.customer.id) && (
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