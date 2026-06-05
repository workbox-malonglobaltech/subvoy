import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ── Service Worker registration ───────────────────────────────────────────────
// Only in production builds — Vite dev server handles HMR instead.

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] Registered — scope:', reg.scope);

        // Check for updates every hour
        setInterval(() => reg.update(), 60 * 60 * 1000);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new version is ready — could show a "refresh to update" toast here
              console.log('[SW] New version available — reload to update');
            }
          });
        });
      })
      .catch(err => console.error('[SW] Registration failed:', err));
  });
}
