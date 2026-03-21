import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const BUILD_TIME = __BUILD_TIME__;
const STORED_KEY = 'eaa_build_v';

async function checkVersion() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { v } = await res.json();

    const stored = localStorage.getItem(STORED_KEY);

    if (stored && stored !== v) {
      localStorage.setItem(STORED_KEY, v);
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      window.location.reload(true);
      return;
    }

    localStorage.setItem(STORED_KEY, v);
  } catch (e) {
    // Brak sieci lub błąd — nic nie rób, uruchom z cache
  }
}

checkVersion();

setInterval(() => {
  if (document.visibilityState !== 'hidden') checkVersion();
}, 15 * 60 * 1000);

if ('serviceWorker' in navigator) {
  // NAPRAWA: zapamiętaj czy SW już istniał PRZED zdarzeniem controllerchange.
  // Przy pierwszej wizycie hadController = false → nie robimy reload (formularz logowania
  // nie resetuje się). Przy aktualizacji hadController = true → reload jak dotychczas.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
  });

  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          nw.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
