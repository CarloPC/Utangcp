import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

// Auto-registers the service worker built by vite-plugin-pwa.
// onNeedRefresh fires when a new version is deployed while the app is open;
// a simple confirm() is enough here, swap for a toast/Alert if you want it prettier.
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