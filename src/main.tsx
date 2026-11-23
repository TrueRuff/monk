import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('root not found');

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
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* офлайн-кэш не критичен */
    });
  });
}
