import { useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import styles from './InstallBanner.module.css';

export default function InstallBanner() {
  const { canInstall, isInstalled, isIOSInstallable, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('installBannerDismissed') === '1'
  );

  if (isInstalled || dismissed) return null;
  if (!canInstall && !isIOSInstallable) return null;

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('installBannerDismissed', '1');
  };

  return (
    <div className={styles.banner} role="status">
      <span className={styles.icon}>📲</span>
      <div className={styles.text}>
        {canInstall ? (
          <>
            <strong>Install Credit Management</strong>
            <p>Add it to your home screen for quick, full-screen access.</p>
          </>
        ) : (
          <>
            <strong>Install this app</strong>
            <p>Tap Share, then "Add to Home Screen".</p>
          </>
        )}
      </div>
      {canInstall && (
        <button type="button" className="btn btn-primary" onClick={promptInstall}>
          Install
        </button>
      )}
      <button type="button" className={styles.dismissBtn} onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}