import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import styles from './OfflineBanner.module.css';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.dot} />
      No internet connection — changes won't save until you're back online.
    </div>
  );
}