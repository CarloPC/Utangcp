import { useState, useMemo } from 'react';
import Alert from '../shared/Alert';
import { formatCurrency } from '../../utils/format';
import { loadRecentlyPaid, markRecentlyPaid } from '../../utils/recentlyPaid';
import styles from './BulkAdd.module.css';

// Cycle of colors used to visually tell amount groups apart.
const GROUP_COLORS = ['#2d68c4', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

let groupIdCounter = 1;
const makeGroupId = () => `g-${groupIdCounter++}-${Date.now().toString(36)}`;

export default function BulkAdd({ customers = [], onBulkAdd }) {
  // Each group is its own custom amount "bucket": { id, amount }.
  const [groups, setGroups] = useState(() => [{ id: makeGroupId(), amount: '100' }]);
  // Which group new selections get assigned to when you tap a customer.
  const [activeGroupId, setActiveGroupId] = useState(() => groups[0].id);
  // Map of customerId -> groupId. A customer can only belong to one group at a time.
  const [assignments, setAssignments] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [recentlyPaid, setRecentlyPaid] = useState(() => loadRecentlyPaid());

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];

  const colorForGroup = (id) => {
    const idx = groups.findIndex((g) => g.id === id);
    return GROUP_COLORS[idx >= 0 ? idx % GROUP_COLORS.length : 0];
  };

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

  const idsForGroup = (gid) => Object.keys(assignments).filter((cid) => assignments[cid] === gid);

  // Assign/unassign a customer to the currently active amount group.
  const assignToActive = (id) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (next[id] === activeGroupId) {
        delete next[id];
      } else {
        next[id] = activeGroupId;
      }
      return next;
    });
  };

  // Select All / Clear act on the visible (filtered) list, for the active group only.
  const selectAll = () => {
    setAssignments((prev) => {
      const next = { ...prev };
      filteredCustomers.forEach((c) => {
        next[c.id] = activeGroupId;
      });
      return next;
    });
  };

  const clearAll = () => {
    setAssignments((prev) => {
      const next = { ...prev };
      filteredCustomers.forEach((c) => {
        if (next[c.id] === activeGroupId) delete next[c.id];
      });
      return next;
    });
  };

  const addGroup = () => {
    const id = makeGroupId();
    setGroups((gs) => [...gs, { id, amount: '' }]);
    setActiveGroupId(id);
  };

  const removeGroup = (id) => {
    if (groups.length <= 1) return;
    const remaining = groups.filter((g) => g.id !== id);
    setGroups(remaining);
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cid) => {
        if (next[cid] === id) delete next[cid];
      });
      return next;
    });
    setActiveGroupId((prev) => (prev === id ? remaining[0]?.id : prev));
  };

  const updateGroupAmount = (id, value) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, amount: value } : g)));
  };

  const totalSelectedCount = Object.keys(assignments).length;

  const grandTotal = groups.reduce(
    (sum, g) => sum + idsForGroup(g.id).length * (Number(g.amount) || 0),
    0
  );

  const activeGroupCount = idsForGroup(activeGroupId).length;

  const handleSubmit = async () => {
    const activeGroups = groups.filter((g) => idsForGroup(g.id).length > 0);

    if (activeGroups.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one customer.' });
      return;
    }
    const invalidGroup = activeGroups.find((g) => !g.amount || Number(g.amount) <= 0);
    if (invalidGroup) {
      setAlert({ type: 'error', message: 'Please enter a valid payment amount for every amount group you used.' });
      return;
    }

    setLoading(true);
    try {
      let allIds = [];
      // Submit one bulk payment per amount group, sequentially.
      for (const g of activeGroups) {
        const ids = idsForGroup(g.id);
        // eslint-disable-next-line no-await-in-loop
        await onBulkAdd(ids, Number(g.amount));
        allIds = allIds.concat(ids);
      }
      // Mark submitted customers as recently paid — persisted for the rest of today
      // and shared with the Payment History tab.
      setRecentlyPaid(markRecentlyPaid(allIds));

      const summary = activeGroups
        .map((g) => `${formatCurrency(Number(g.amount))} × ${idsForGroup(g.id).length}`)
        .join(', ');
      setAlert({
        type: 'success',
        message: `Payment added to ${allIds.length} customer${allIds.length > 1 ? 's' : ''} successfully! (${summary})`,
      });
      setAssignments({});
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

        <div className={styles.groupsRow}>
          {groups.map((g) => {
            const count = idsForGroup(g.id).length;
            const isActive = g.id === activeGroupId;
            const color = colorForGroup(g.id);
            return (
              <div
                key={g.id}
                className={`${styles.groupChip} ${isActive ? styles.groupChipActive : ''}`}
                style={{ '--group-color': color }}
                onClick={() => setActiveGroupId(g.id)}
              >
                <span className={styles.groupChipCurrency}>₱</span>
                <input
                  type="number"
                  min="1"
                  className={styles.groupChipInput}
                  placeholder="Amount"
                  value={g.amount}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateGroupAmount(g.id, e.target.value)}
                />
                <span className={styles.groupChipCount}>
                  {count} {count === 1 ? 'person' : 'people'}
                </span>
                {groups.length > 1 && (
                  <button
                    type="button"
                    className={styles.groupChipRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(g.id);
                    }}
                    aria-label="Remove this amount"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className={styles.addGroupBtn} onClick={addGroup}>
            + Add Custom Amount
          </button>
        </div>

        <p className={styles.groupHint}>
          Tap an amount above to make it active, then tap customers below to add them to it — mix
          as many custom amounts as you need.
        </p>

        {totalSelectedCount > 0 && (
          <div className={styles.summaryBox}>
            <span className={styles.summaryLabel}>Total to be Applied</span>
            <span className={styles.summaryValue}>{formatCurrency(grandTotal)}</span>
            <span className={styles.summaryMeta}>
              {groups
                .filter((g) => idsForGroup(g.id).length > 0)
                .map((g) => `${formatCurrency(Number(g.amount) || 0)} × ${idsForGroup(g.id).length}`)
                .join('  +  ')}
            </span>
          </div>
        )}
      </div>

      {/* Customer List Card */}
      <div className={styles.listCard}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <h3 className={styles.formTitle} style={{ margin: 0 }}>Select Customers</h3>
            <span
              className={styles.badge}
              style={{ background: colorForGroup(activeGroupId) }}
            >
              Adding to {formatCurrency(Number(activeGroup?.amount) || 0)} — {activeGroupCount} selected
            </span>
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
                const assignedGroupId = assignments[c.id];
                const isChecked = assignedGroupId === activeGroupId;
                const assignedOtherGroup = assignedGroupId && !isChecked
                  ? groups.find((g) => g.id === assignedGroupId)
                  : null;
                const isPaid = recentlyPaid.has(c.id);
                return (
                  <li
                    key={c.id}
                    className={[
                      styles.item,
                      isChecked ? styles.itemChecked : '',
                      isPaid ? styles.itemRecentlyPaid : '',
                    ].join(' ')}
                    style={
                      assignedOtherGroup
                        ? { borderLeft: `3px solid ${colorForGroup(assignedOtherGroup.id)}` }
                        : undefined
                    }
                    onClick={() => assignToActive(c.id)}
                  >
                    <div className={styles.checkboxWrap}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isChecked}
                        onChange={() => assignToActive(c.id)}
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
                      {assignedOtherGroup && (
                        <span
                          className={styles.groupTag}
                          style={{ '--group-color': colorForGroup(assignedOtherGroup.id) }}
                        >
                          {formatCurrency(Number(assignedOtherGroup.amount) || 0)}
                        </span>
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
          {totalSelectedCount > 0 ? (
            <span>
              <strong>{totalSelectedCount}</strong> customer{totalSelectedCount > 1 ? 's' : ''} selected
              across <strong>{groups.filter((g) => idsForGroup(g.id).length > 0).length}</strong> amount
              {groups.filter((g) => idsForGroup(g.id).length > 0).length > 1 ? 's' : ''}
              {' '}&mdash; <strong>{formatCurrency(grandTotal)}</strong> total
            </span>
          ) : (
            <span className={styles.footerHint}>Select customers above to add a payment</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-success"
          onClick={handleSubmit}
          disabled={loading || totalSelectedCount === 0}
        >
          {loading ? 'Adding Payments…' : `Add Payment to ${totalSelectedCount > 0 ? totalSelectedCount : ''} Selected`}
        </button>
      </div>
    </div>
  );
}
