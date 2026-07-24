import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Import first, before anything else — this attaches the
// beforeinstallprompt listener at the earliest possible moment,
// so it's captured even before the user logs in / Header mounts.
import './utils/installPromptStore';

import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('A new version of Credit Management is available. Reload now?')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline.');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);