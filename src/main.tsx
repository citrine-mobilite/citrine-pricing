// Supprimer les erreurs [vite] et WebSocket conformément aux contraintes AI Studio
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = (...args: any[]) => {
    const str = args.map(a => String(a?.message || a || '')).join(' ');
    if (str.includes('[vite]') || str.includes('websocket') || str.includes('WebSocket')) {
      return;
    }
    origError.apply(console, args);
  };
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Purge automatique des Service Workers et des caches obsolètes dans le navigateur
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  }).catch(() => {});
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

