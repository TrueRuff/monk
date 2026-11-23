export type Theme = 'gold' | 'blue' | 'jade' | 'violet';

export const THEMES: { id: Theme; label: string; swatch: string }[] = [
  { id: 'gold', label: 'Золото', swatch: 'linear-gradient(135deg,#f0c97a,#c98f35)' },
  { id: 'blue', label: 'Синий', swatch: 'linear-gradient(135deg,#94c2ff,#3d6ed6)' },
  { id: 'jade', label: 'Изумруд', swatch: 'linear-gradient(135deg,#7ee5c0,#2a9e7b)' },
  { id: 'violet', label: 'Фиалка', swatch: 'linear-gradient(135deg,#c0a9ff,#7150d8)' },
];

const BG: Record<Theme, string> = {
  gold: '#08080a',
  blue: '#070a10',
  jade: '#060c09',
  violet: '#0a0812',
};

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'gold' || value === 'blue' || value === 'jade' || value === 'violet';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BG[theme]);
}
