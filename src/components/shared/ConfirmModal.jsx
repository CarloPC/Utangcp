import styles from './ConfirmModal.module.css';

/**
 * @param {{ title: string, message: string, onConfirm: () => void, onCancel: () => void, loading?: boolean, confirmLabel?: string, loadingLabel?: string, confirmClass?: string }} props
 */
export default function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  loading = false,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting…',
  confirmClass = 'btn btn-danger',
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}