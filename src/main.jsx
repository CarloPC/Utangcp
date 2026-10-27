import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Import first, before anything else — this attaches the
// beforeinstallprompt listener at the earliest possible moment,
// so it's captured even before the user logs in / Header mounts.
import './utils/installPromptStore';

import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import PullToRefresh from './components/shared/PullToRefresh';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('A new version of Credit Management is available. Reload now?')) {
      // updateSW(true) activates the waiting service worker AND reloads;
      // a bare location.reload() would just serve the old cached version again.
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline.');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PullToRefresh />
  </StrictMode>
);