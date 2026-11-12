// Значки категорий в стиле «стикеры» (плоская заливка цветом категории, белые детали) и маскот «Cats love fish».
// Значок категории хранится строкой 'i:<ключ>'; всё остальное считается эмодзи (свои категории).
import { esc } from './util.js';

const P = '#3A2540';
const DOT = `fill="#fff" stroke="none"`;

const ICONS = {
  cart: `<path d="M4.5 9h15l-1.6 9.2a1 1 0 0 1-1 .8H7.1a1 1 0 0 1-1-.8z"/><path d="M9 9l2.5-4.5M15 9l-2.5-4.5" fill="none"/>`,
  cafe: `<path d="M6 9h10v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4z"/><path d="M16 10h1.5a2 2 0 0 1 0 4H16M10 5v2M13 5v2" fill="none"/>`,
  bus: `<rect x="5" y="5" width="14" height="12" rx="3"/><path d="M5 11h14" fill="none" data-w/><path d="M7.5 17v2M16.5 17v2" fill="none"/><circle cx="8.8" cy="14" r=".7" ${DOT}/><circle cx="15.2" cy="14" r=".7" ${DOT}/>`,
  home: `<path d="M5 11l7-6 7 6v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M10 19v-4h4v4" fill="none" data-w/>`,
  phone: `<rect x="7.5" y="3.5" width="9" height="17" rx="2.5"/><path d="M11 17.5h2" fill="none" data-w/>`,
  pill: `<rect x="3.5" y="9" width="17" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5" fill="none" data-w/>`,
  shirt: `<path d="M9 5L4 8l2 3 2-1v9h8v-9l2 1 2-3-5-3a3 3 0 0 1-6 0z"/>`,
  spark: `<path d="M12 3c.8 5 4 8.2 9 9-5 .8-8.2 4-9 9-.8-5-4-8.2-9-9 5-.8 8.2-4 9-9z"/>`,
  ticket: `<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2" fill="none" data-w/>`,
  gift: `<rect x="4.5" y="9" width="15" height="10" rx="1.5"/><path d="M12 9v10M4.5 13h15" fill="none" data-w/><path d="M12 9c-3-4-6-1-4 0M12 9c3-4 6-1 4 0" fill="none"/>`,
  book: `<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18" fill="none"/>`,
  paw: `<ellipse cx="12" cy="15.5" rx="4.5" ry="3.6"/><circle cx="6.5" cy="10.5" r="1.6"/><circle cx="10" cy="6.8" r="1.6"/><circle cx="14" cy="6.8" r="1.6"/><circle cx="17.5" cy="10.5" r="1.6"/>`,
  plane: `<path d="M3.5 12.5l17-8-6 15-3-6z"/><path d="M11.5 13.5l3-4" fill="none" data-w/>`,
  box: `<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8" fill="none" data-w/>`,
  case: `<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8" fill="none"/><path d="M4 13h16" fill="none" data-w/>`,
  bulb: `<path d="M9 16c-2-1.2-3-3-3-5a6 6 0 0 1 12 0c0 2-1 3.8-3 5z"/><path d="M10 19h4M10.5 21h3" fill="none"/>`,
  coin: `<circle cx="12" cy="12" r="8"/><path d="M12 8.5c.4 2.2 1.3 3.1 3.5 3.5-2.2.4-3.1 1.3-3.5 3.5-.4-2.2-1.3-3.1-3.5-3.5 2.2-.4 3.1-1.3 3.5-3.5z" ${DOT}/>`,
  back: `<path d="M9 7L4.5 11.5 9 16" fill="none"/><path d="M5 11.5h9a4.5 4.5 0 0 1 0 9h-4" fill="none"/>`,
  carrot: `<path d="M7.5 9.5l7 7-9.5 3z"/><path d="M13 6.5l1.5-2.5M15.5 9l3-1.5M11 5.5l-.5-2.5" fill="none"/>`,
  apple: `<path d="M12 8.5c-2-1.5-6-1-6 3.5 0 3.5 2.5 7 6 7s6-3.5 6-7c0-4.5-4-5-6-3.5z"/><path d="M12 8.5c0-2 .5-3 2-4" fill="none"/>`,
  meat: `<path d="M6 10c0-3 3-5 7-5s6 2 6 5-2 5-5 6c-1 2-3 3-5 2-2-1-2-3-1-4-2-1-2-2-2-4z"/><circle cx="9.5" cy="14.5" r="1.1" fill="none" data-w/>`,
  drum: `<path d="M14 5a5 5 0 0 1 2 8l-3 3a5 5 0 0 1-8-2z"/><path d="M5.5 17l-2 2m3.5.5l-2 2" fill="none"/>`,
  fish: `<path d="M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2z"/><circle cx="8" cy="11" r=".7" ${DOT}/>`,
  milk: `<path d="M8 4h8l1 4v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8z"/><path d="M7 8h10M10 12h4" fill="none" data-w/>`,
  egg: `<path d="M12 4c3.5 0 6 5.5 6 9a6 6 0 0 1-12 0c0-3.5 2.5-9 6-9z"/>`,
  loaf: `<path d="M5 12c0-3 3-5 7-5s7 2 7 5v6H5z"/><path d="M9 11l1 3M13 11l1 3" fill="none" data-w/>`,
  jar: `<rect x="6.5" y="8" width="11" height="12" rx="2.5"/><path d="M8 8V5.5h8V8" fill="none"/>`,
  wheat: `<path d="M12 20V8M12 8c-2-.5-3-2-3-4 2 .5 3 2 3 4zM12 8c2-.5 3-2 3-4-2 .5-3 2-3 4zM12 13c-2-.5-3-2-3-4M12 13c2-.5 3-2 3-4" fill="none"/>`,
  candy: `<rect x="8" y="8" width="8" height="8" rx="3"/><path d="M8 12L4 9v6zM16 12l4-3v6z"/>`,
  chips: `<path d="M7 4h10l-1 16H8z"/><path d="M7.5 8h9M8 16h8" fill="none" data-w/>`,
  glass: `<path d="M8 5h8l-1 15H9z"/><path d="M8.5 10h7" fill="none" data-w/>`,
  snow: `<path d="M12 4v16M5 8l14 8M5 16l14-8" fill="none"/>`,
  bento: `<rect x="4" y="8" width="16" height="10" rx="2.5"/><path d="M12 8v10M4 13h8" fill="none" data-w/>`,
  spray: `<path d="M9 10h6v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M10 10V7h4l2-2M18 5.5h2" fill="none"/>`,
  drop: `<path d="M12 4c3 4 5.5 6.5 5.5 10a5.5 5.5 0 0 1-11 0C6.5 10.5 9 8 12 4z"/>`,
  can: `<rect x="7" y="4.5" width="10" height="15" rx="2.5"/><path d="M13.2 7.5l-3 4.8h3l-2.2 4.2" fill="none" data-w/>`,
  smile: `<circle cx="12" cy="12" r="7.5"/><circle cx="9.5" cy="11" r=".7" ${DOT}/><circle cx="14.5" cy="11" r=".7" ${DOT}/><path d="M9.5 14.5c1.5 1.5 3.5 1.5 5 0" fill="none" data-w/>`,
};

const svg = key => `<svg class="gi" viewBox="0 0 24 24" fill="var(--ink,#A775C9)" stroke="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;

// Значок для вставки в HTML: svg для 'i:ключ', иначе эмодзи.
export function iconHtml(icon) {
  if (typeof icon === 'string' && icon.startsWith('i:') && ICONS[icon.slice(2)]) return svg(icon.slice(2));
  return esc(icon);
}
// Для мест, где разметка невозможна (<option>, обычный текст): эмодзи или пусто.
export const iconText = icon => (typeof icon === 'string' && icon.startsWith('i:') ? '' : icon || '');

// Котики (картинки пользователя, assets/): вырезанный котик на прозрачном фоне: для шапки и пустых экранов.
const CATS = { a: ['cat.png', 0.705], b: ['cat.png', 0.705], c: ['cat.png', 0.705] };
export function mascot(size = 44, v = 'a') {
  const [file, ratio] = CATS[v] || CATS.a;
  return `<img class="mascot mascot-${v}" src="assets/${file}" width="${size}" height="${Math.round(size * ratio)}" alt="" decoding="async">`;
}
