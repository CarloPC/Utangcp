import { useMemo } from 'react';
import { formatCurrency } from '../../utils/format';
import styles from './Statistics.module.css';

export default function Statistics({ customers }) {
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
