import { useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/format';
import styles from './Statistics.module.css';

// Local (not UTC) YYYY-MM-DD so the default dates are correct for PH time
const localToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Statistics({ customers, payments = [] }) {
  const [startDate, setStartDate] = useState(localToday);
  const [endDate, setEndDate] = useState(localToday);
  const [range, setRange] = useState(null); // applied range after clicking Analyze
  const [rangeError, setRangeError] = useState('');

  const handleAnalyze = () => {
    if (!startDate || !endDate) {
      setRangeError('Please choose both a start and an end date.');
      return;
    }
    if (startDate > endDate) {
      setRangeError('Start date must be on or before the end date.');
      return;
    }
    setRangeError('');
    setRange({ start: startDate, end: endDate });
  };

  // Dates are stored as YYYY-MM-DD strings, so string comparison is safe.
  const analysis = useMemo(() => {
    if (!range) return null;
    const inRange = (d) => d && d >= range.start && d <= range.end;

    const rangePayments = payments.filter((p) => inRange(p.payment_date));
    const earned = rangePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const newCustomers = customers.filter((c) => inRange(c.date));
    const creditGiven = newCustomers.reduce((s, c) => s + (Number(c.price) || 0), 0);

    return {
      earned,
      paymentCount: rangePayments.length,
      newCount: newCustomers.length,
      creditGiven,
    };
  }, [range, payments, customers]);

  const stats = useMemo(() => {
    const total = customers.length;
    const totalPrice = customers.reduce((s, c) => s + (c.price || 0), 0);
    const totalPaid = customers.reduce((s, c) => s + (c.paid || 0), 0);
    const totalDebt = customers
      .filter((c) => c.remaining_balance > 0)
      .reduce((s, c) => s + c.remaining_balance, 0);
    return { total, totalPrice, totalPaid, totalDebt };
  }, [customers]);

  const debtors = useMemo(
    () =>
      customers
        .filter((c) => c.remaining_balance > 0)
        .sort((a, b) => b.remaining_balance - a.remaining_balance),
    [customers]
  );

  const CARDS = [
    { label: 'Total Customers', value: stats.total, gradient: 'linear-gradient(135deg,#1E4482,#2D68C4)', big: true },
    { label: 'Total Price', value: formatCurrency(stats.totalPrice), gradient: 'linear-gradient(135deg,#0F7749,#16A34A)' },
    { label: 'Total Payments Received', value: formatCurrency(stats.totalPaid), gradient: 'linear-gradient(135deg,#0369A1,#0EA5E9)' },
    { label: 'Total Debt', value: formatCurrency(stats.totalDebt), gradient: 'linear-gradient(135deg,#9B2226,#DC2626)' },
  ];

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>Statistics Overview</h2>

      <div className={styles.grid}>
        {CARDS.map((card) => (
          <div key={card.label} className={styles.card} style={{ background: card.gradient }}>
            <span className={styles.cardValue}>{card.value}</span>
            <span className={styles.cardLabel}>{card.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.debtorsSection}>
        <h3 className={styles.subHeading}>Top Debtors</h3>

        <div className={styles.analyzer}>
          <div className={styles.analyzerRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="stat-start">From</label>
              <input
                id="stat-start"
                className="input"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="stat-end">To</label>
              <input
                id="stat-end"
                className="input"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button type="button" className={styles.analyzeBtn} onClick={handleAnalyze}>
              📊 Analyze
            </button>
          </div>

          {rangeError && <p className={styles.rangeError}>{rangeError}</p>}

          {analysis && (
            <>
              <p className={styles.rangeLabel}>
                {formatDate(range.start)}
                {range.start !== range.end && ` – ${formatDate(range.end)}`}
              </p>
              <div className={styles.resultGrid}>
                <div className={styles.resultCard}>
                  <span className={styles.resultValue} style={{ color: 'var(--color-success-text)' }}>
                    {formatCurrency(analysis.earned)}
                  </span>
                  <span className={styles.resultLabel}>
                    Earned ({analysis.paymentCount} payment{analysis.paymentCount === 1 ? '' : 's'})
                  </span>
                </div>
                <div className={styles.resultCard}>
                  <span className={styles.resultValue}>{analysis.newCount}</span>
                  <span className={styles.resultLabel}>New Customers</span>
                </div>
                <div className={styles.resultCard}>
                  <span className={styles.resultValue} style={{ color: 'var(--color-warning-text)' }}>
                    {formatCurrency(analysis.creditGiven)}
                  </span>
                  <span className={styles.resultLabel}>New Credit Given</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer Name</th>
                <th>Product</th>
                <th>Outstanding Balance</th>
              </tr>
            </thead>
            <tbody>
              {debtors.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>🎉 No outstanding debts!</td>
                </tr>
              ) : (
                debtors.map((c, i) => (
                  <tr key={c.id}>
                    <td className={styles.rank}>{i + 1}</td>
                    <td className={styles.name}>{c.firstname} {c.lastname}</td>
                    <td>{c.product_name}</td>
                    <td className={styles.debt}>{formatCurrency(c.remaining_balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
