import { useEffect, useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import styles from './InstallPopup.module.css';

/**
 * Externally controlled — App.jsx decides when to open it, either:
 *  - automatically, ~1.2s after every fresh login, or
 *  - manually, via the "Install App" row in the Header dropdown
 * Both paths share this one component/hook instance so state (canInstall,
 * isInstalled) is always accurate regardless of which path opened it.
 */
export default function InstallPopup({ open, onClose }) {
  const { canInstall, isInstalled, isIOSInstallable, promptInstall } = useInstallPrompt();
  const [closing, setClosing] = useState(false);

  // Auto-close if the app gets installed while this happens to be open.
  useEffect(() => {
    if (isInstalled && open) onClose();
  }, [isInstalled, open, onClose]);

  if (!open) return null;
  if (isInstalled) return null;
  if (!canInstall && !isIOSInstallable) return null;

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 180);
  };

  const handleInstall = async () => {
    await promptInstall();
    close();
  };

  return (
    <div className={`${styles.overlay} ${closing ? styles.closing : ''}`} onClick={close}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.badge}>💳</div>
        <h2 className={styles.title}>Install Credit Management</h2>
        <p className={styles.subtitle}>
          {canInstall
            ? 'Add it to your home screen for faster, full-screen access — no browser bar, no address bar.'
            : 'Tap the Share icon in Safari, then "Add to Home Screen".'}
        </p>

        <div className={styles.actions}>
          {canInstall && (
            <button type="button" className="btn btn-primary" onClick={handleInstall}>
              Install App
            </button>
          )}
          <button type="button" className={styles.laterBtn} onClick={close}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}