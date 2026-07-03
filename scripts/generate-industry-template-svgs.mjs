import fs from 'fs';
import path from 'path';

const themes = [
  { id: 'fashion-wardrobe', name: 'Wardrobe Resale', sub: 'List catalog', colors: ['#9f1239', '#fce7f3', '#faf8f6', '#1c1917'] },
  { id: 'fashion-boutique-list', name: 'Dress Rack', sub: 'Grid catalog', colors: ['#4a3728', '#b45309', '#fffaf5', '#292524'] },
  { id: 'fashion-linen', name: 'Linen Lane', sub: 'Subtle', colors: ['#78716c', '#fafaf9', '#ffffff', '#a8a29e'] },
  { id: 'fashion-runway', name: 'Runway Rack', sub: 'Modern', colors: ['#0f0f0f', '#e11d48', '#ffffff', '#18181b'] },
  { id: 'fashion-maharani', name: 'Maharani Closet', sub: 'Traditional', colors: ['#7f1d1d', '#fef3c7', '#b45309', '#fffbeb'] },
  { id: 'jewel-tray', name: 'Jewel Tray', sub: 'Grid catalog', colors: ['#1e3a5f', '#c9a227', '#f8fafc', '#0f172a'] },
  { id: 'jewel-counter', name: 'Gold Counter', sub: 'List catalog', colors: ['#334155', '#0d9488', '#ffffff', '#1e293b'] },
  { id: 'jewel-pearl', name: 'Pearl Room', sub: 'Subtle', colors: ['#6b5b4f', '#c4a574', '#fffcfa', '#f7f3ef'] },
  { id: 'jewel-apex', name: 'Apex Jewels', sub: 'Modern', colors: ['#c9a227', '#060912', '#60a5fa', '#e8edf5'] },
  { id: 'jewel-royal', name: 'Royal Gem House', sub: 'Traditional', colors: ['#831843', '#ca8a04', '#fef9c3', '#fffdf7'] },
];

const root = path.resolve('public/templates');

for (const t of themes) {
  const dir = path.join(root, t.id);
  fs.mkdirSync(dir, { recursive: true });
  const [a, b, bg, text] = t.colors;
  const preview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" role="img" aria-label="${t.name} preview">
  <rect width="800" height="500" fill="${bg}"/>
  <rect x="220" y="36" width="360" height="428" rx="20" fill="#fff" stroke="${a}22" stroke-width="2"/>
  <rect x="220" y="36" width="360" height="88" fill="${a}"/>
  <text x="248" y="88" fill="#fff" font-family="Georgia,serif" font-size="22">${t.name}</text>
  <rect x="248" y="148" width="120" height="72" rx="10" fill="${b}"/>
  <rect x="380" y="148" width="120" height="72" rx="10" fill="${b}"/>
  <rect x="512" y="148" width="48" height="72" rx="10" fill="${b}"/>
  <rect x="248" y="240" width="312" height="56" rx="12" fill="#fff" stroke="${a}33"/>
  <rect x="248" y="312" width="312" height="56" rx="12" fill="#fff" stroke="${a}33"/>
  <rect x="248" y="384" width="312" height="56" rx="12" fill="#fff" stroke="${a}33"/>
  <text x="40" y="56" fill="${text}" font-family="Georgia,serif" font-size="26">${t.name}</text>
  <text x="40" y="88" fill="${text}" opacity="0.7" font-family="system-ui,sans-serif" font-size="14">${t.sub}</text>
  <rect x="40" y="108" width="16" height="16" rx="3" fill="${a}"/>
  <rect x="62" y="108" width="16" height="16" rx="3" fill="${b}"/>
  <rect x="84" y="108" width="16" height="16" rx="3" fill="${bg}" stroke="${a}55"/>
  <rect x="106" y="108" width="16" height="16" rx="3" fill="#fff" stroke="${a}33"/>
</svg>`;
  fs.writeFileSync(path.join(dir, 'preview.svg'), preview);
  const grad = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/></svg>`;
  for (const name of ['hero.svg', 'story.svg', 'slide1.svg', 'slide2.svg', 'slide3.svg', 'trust1.svg', 'trust2.svg', 'trust3.svg', 'craft.svg', 'bridal.svg', 'video-poster.svg']) {
    fs.writeFileSync(path.join(dir, name), grad);
  }
}

console.log('Generated industry template SVG assets');
