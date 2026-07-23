import { useEffect } from 'react';
import styles from './Alert.module.css';

/**
 * @param {{ type: 'success'|'error', message: string, onClose: () => void, autoDismiss?: number }} props
 */
export default function Alert({ type = 'success', message, onClose, autoDismiss = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, autoDismiss);
    return () => clearTimeout(timer);
  }, [message, onClose, autoDismiss]);

  if (!message) return null;

  return (
    <div className={`${styles.alert} ${styles[type]}`} role="alert">
      <span>{message}</span>
      <button className={styles.close} onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}
