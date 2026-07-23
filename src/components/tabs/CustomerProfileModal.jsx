import { formatCurrency, formatDate } from '../../utils/format';
import styles from './CustomerProfileModal.module.css';

function initials(customer) {
  const a = customer.firstname?.[0] || '';
  const b = customer.lastname?.[0] || '';
  return (a + b).toUpperCase() || '?';
}

export default function CustomerProfileModal({ customer, payments, onClose, onEdit }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className={styles.modalHeader}>
          <h3>Customer Profile</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.photoSection}>
            {customer.photo_url ? (
              <img
                src={customer.photo_url}
                alt={`${customer.firstname} ${customer.lastname}`}
                className={styles.photo}
              />
            ) : (
              <div className={styles.photoFallback}>{initials(customer)}</div>
            )}
            <h2 className={styles.name}>{customer.firstname} {customer.lastname}</h2>
            <span className={styles.mobile}>
              {customer.mobile_number || 'No mobile number provided'}
            </span>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Product</span>
              <span className={styles.detailValue}>{customer.product_name}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date</span>
              <span className={styles.detailValue}>{formatDate(customer.date)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Total Price</span>
              <span className={styles.detailValue}>{formatCurrency(customer.price)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Amount Paid</span>
              <span className={styles.detailValue}>{formatCurrency(customer.paid)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Remaining Balance</span>
              <span className={`${styles.detailValue} ${customer.remaining_balance > 0 ? styles.balanceNeg : styles.balancePos}`}>
                {formatCurrency(customer.remaining_balance)}
              </span>
            </div>
          </div>

          <div className={styles.historySection}>
            <strong className={styles.historyTitle}>Payment History</strong>
            {payments.length === 0 ? (
              <p className={styles.noPayments}>No payment history.</p>
            ) : (
              <ul className={styles.paymentList}>
                {payments.map((p) => (
                  <li key={p.id} className={styles.paymentItem}>
                    <span className={styles.payAmt}>{formatCurrency(p.amount)}</span>
                    <span className={styles.payDate}>on {formatDate(p.payment_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          {onEdit && (
            <button type="button" className="btn btn-warning" onClick={() => { onClose(); onEdit(customer); }}>
              Edit Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}