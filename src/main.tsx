import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './app/styles.css';
import { applyTheme, isTheme } from './shared/theme';

const root = document.getElementById('root');
if (!root) throw new Error('root not found');

const fromUrl = new URLSearchParams(window.location.search).get('theme');
if (isTheme(fromUrl)) applyTheme(fromUrl);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'activated') {
              window.location.reload();
            }
          });
        });
        void registration.update();
      })
      .catch(() => {
        /* офлайн-кэш не критичен */
      });
  });
}
