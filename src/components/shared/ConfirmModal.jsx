import styles from './ConfirmModal.module.css';

/**
 * @param {{ title: string, message: string, onConfirm: () => void, onCancel: () => void, loading?: boolean }} props
 */
export default function ConfirmModal({ title, message, onConfirm, onCancel, loading = false }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
