import { useEffect, useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import styles from './InstallPopup.module.css';

/**
 * Shows an install popup ONLY right after a fresh login — not on every
 * page load/refresh while already logged in.
 *
 * How "just logged in" is detected: the parent (App.jsx) passes
 * `justLoggedIn` — a flag it flips true the moment `user` goes from
 * null/undefined to a real user object, then resets on next render.
 * See the wiring note in the setup guide.
 */
export default function InstallPopup({ justLoggedIn }) {
  const { canInstall, isInstalled, isIOSInstallable, promptInstall } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!justLoggedIn) return;
    if (isInstalled) return;
    if (!canInstall && !isIOSInstallable) return;

    // Small delay so it doesn't compete with the dashboard's first paint.
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [justLoggedIn, isInstalled, canInstall, isIOSInstallable]);

  if (!visible) return null;

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
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