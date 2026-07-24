import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe, triggerInstall } from '../utils/installPromptStore';

/**
 * Reads from the shared installPromptStore (see src/utils/installPromptStore.js)
 * instead of attaching its own listener — so state is correct no matter
 * when/where a component using this hook mounts.
 */
export function useInstallPrompt() {
  const { canInstall, isInstalled } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isIOSInstallable = isIOS && !isInstalled;

  return {
    canInstall,
    isInstalled,
    isIOSInstallable,
    promptInstall: triggerInstall,
  };
}