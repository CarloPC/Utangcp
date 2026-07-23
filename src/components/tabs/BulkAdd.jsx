import { useState, useMemo } from 'react';
import Alert from '../shared/Alert';
import { formatCurrency } from '../../utils/format';
import { loadRecentlyPaid, markRecentlyPaid } from '../../utils/recentlyPaid';
import styles from './BulkAdd.module.css';

export default function BulkAdd({ customers = [], onBulkAdd }) {
  const [selected, setSelected] = useState({});
  const [amount, setAmount] = useState('100');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [recentlyPaid, setRecentlyPaid] = useState(() => loadRecentlyPaid());

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  // Only show customers with a remaining balance > 0
  const unpaidCustomers = useMemo(
    () => customers.filter((c) => (c.remaining_balance ?? 0) > 0),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase();
    return unpaidCustomers.filter(
      (c) =>
        !q ||
        c.firstname?.toLowerCase().includes(q) ||
        c.lastname?.toLowerCase().includes(q) ||
        c.product_name?.toLowerCase().includes(q)
    );
  }, [unpaidCustomers, search]);

  const selectAll = () => {
    const all = {};
    filteredCustomers.forEach((c) => (all[c.id] = true));
    setSelected((s) => ({ ...s, ...all }));
  };

  const clearAll = () => setSelected({});

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const selectedCount = selectedIds.length;

  const totalAmount = selectedCount * (Number(amount) || 0);

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one customer.' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setAlert({ type: 'error', message: 'Please enter a valid payment amount.' });
      return;
    }
    setLoading(true);
    try {
      await onBulkAdd(selectedIds, Number(amount));
      // Mark submitted customers as recently paid — persisted for the rest of today
      // and shared with the Payment History tab.
      setRecentlyPaid(markRecentlyPaid(selectedIds));
      setAlert({
        type: 'success',
        message: `Payment of ${formatCurrency(Number(amount))} added to ${selectedCount} customer${selectedCount > 1 ? 's' : ''} successfully!`,
      });
      setSelected({});
    } catch {
      setAlert({ type: 'error', message: 'Failed to add payments. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Bulk Add Payment</h2>

      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      {/* Amount Card */}
      <div className={styles.formCard}>
        <h3 className={styles.formTitle}>Payment Settings</h3>
        <div className={styles.amountRow}>
          <div className={styles.group}>
            <label className="label" htmlFor="bulk-amount">
              Payment Amount (₱)
            </label>
            <input
              id="bulk-amount"
              className="input"
              type="number"
              min="1"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {selectedCount > 0 && (
            <div className={styles.summaryBox}>
              <span className={styles.summaryLabel}>Total to be Applied</span>
              <span className={styles.summaryValue}>{formatCurrency(totalAmount)}</span>
              <span className={styles.summaryMeta}>
                {formatCurrency(Number(amount) || 0)} × {selectedCount} customer{selectedCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Customer List Card */}
      <div className={styles.listCard}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <h3 className={styles.formTitle} style={{ margin: 0 }}>Select Customers</h3>
            {selectedCount > 0 && (
              <span className={styles.badge}>{selectedCount} selected</span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                className={styles.searchInput}
                placeholder="Search customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>
              Select All
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>

        {/* List */}
        <div className={styles.listBody}>
          {filteredCustomers.length === 0 ? (
            <div className={styles.empty}>
              {search ? 'No customers match your search.' : 'No customers with outstanding balance.'}
            </div>
          ) : (
            <ul className={styles.list}>
              {filteredCustomers.map((c) => {
                const isChecked = !!selected[c.id];
                const isPaid = recentlyPaid.has(c.id);
                return (
                  <li
                    key={c.id}
                    className={[
                      styles.item,
                      isChecked ? styles.itemChecked : '',
                      isPaid ? styles.itemRecentlyPaid : '',
                    ].join(' ')}
                    onClick={() => toggle(c.id)}
                  >
                    <div className={styles.checkboxWrap}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isChecked}
                        onChange={() => toggle(c.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className={styles.customerInfo}>
                      <span className={styles.customerName}>
                        {c.firstname} {c.lastname}
                      </span>
                      {c.product_name && (
                        <span className={styles.productTag}>{c.product_name}</span>
                      )}
                      {isPaid && (
                        <span className={styles.paidTag}>✓ Paid this session</span>
                      )}
                    </div>
                    <div className={styles.balanceWrap}>
                      <span className={styles.balanceLabel}>Balance</span>
                      <span className={styles.balanceValue}>
                        {formatCurrency(c.remaining_balance ?? 0)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Footer Action */}
      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          {selectedCount > 0 ? (
            <span>
              <strong>{selectedCount}</strong> customer{selectedCount > 1 ? 's' : ''} selected
              {amount && Number(amount) > 0 && (
                <> &mdash; <strong>{formatCurrency(totalAmount)}</strong> total</>
              )}
            </span>
          ) : (
            <span className={styles.footerHint}>Select customers above to add a payment</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-success"
          onClick={handleSubmit}
          disabled={loading || selectedCount === 0}
        >
          {loading ? 'Adding Payments…' : `Add Payment to ${selectedCount > 0 ? selectedCount : ''} Selected`}
        </button>
      </div>
    </div>
  );
}