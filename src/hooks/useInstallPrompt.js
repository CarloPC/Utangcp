import { useEffect, useState } from 'react';

/**
 * Captures the browser's native "Add to Home Screen" prompt so you can
 * trigger it from your own styled button instead of waiting for the
 * browser's default mini-infobar.
 *
 * Note: this fires on Chrome/Edge/Android. iOS Safari does NOT support
 * beforeinstallprompt — there, users must use Share -> Add to Home Screen,
 * so show them instructions instead (see InstallBanner.jsx).
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isIOSInstallable = isIOS && !isInstalled;

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isIOSInstallable,
    promptInstall,
  };
}