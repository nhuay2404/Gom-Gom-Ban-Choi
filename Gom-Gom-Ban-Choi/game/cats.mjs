// Art mèo dùng chung cho các chế độ Gom Gom: 6 loại, vẽ bằng SVG.
// Mỗi loại có tai, kiểu mắt và một biểu cảm (mood) riêng, không loại nào trùng loại nào.
export const categories = {
  orange: { name: 'Mèo cam', color: '#f39a45', fur: '#f5a04e', side: '#c9702a', stripe: '#d9772f', belly: '#ffe3bf', paw: '#ffe3bf', eye: '#3a2a22', ears: 'pointy', eyeStyle: 'sparkle', mood: 'grin' },
  gray: { name: 'Mèo xám', color: '#a9adb5', fur: '#aeb2ba', side: '#7c818b', stripe: '#6c717a', belly: '#f6f6f4', paw: '#f6f6f4', eye: '#3a3a3a', ears: 'round', eyeStyle: 'dot', mood: 'happy' },
  white: { name: 'Mèo trắng', color: '#f4efe8', fur: '#fbf8f3', side: '#d7cfc4', belly: '#fbf8f3', paw: '#fffdf9', eye: '#3a3030', ears: 'tall', eyeStyle: 'oval', mood: 'sparkly' },
  tuxedo: { name: 'Mèo mun', color: '#2f2c31', fur: '#322f35', side: '#1a181c', belly: '#fbf8f3', muzzle: true, paw: '#fbf8f3', eye: '#e8b53a', ears: 'small', eyeStyle: 'slit', mood: 'wink' },
  siamese: { name: 'Mèo Xiêm', color: '#e8d6bd', fur: '#efe0cb', side: '#c4ab8c', mask: '#6b4a3a', belly: '#f7ecdc', paw: '#6b4a3a', eye: '#4aa3e0', ears: 'wide', eyeStyle: 'iris', mood: 'smile' },
  tabby: { name: 'Mèo mướp', color: '#9a7550', fur: '#a27c55', side: '#6f5236', stripe: '#5a4128', belly: '#e9d6b8', paw: '#e9d6b8', eye: '#7fae3a', ears: 'fold', eyeStyle: 'slit', mood: 'blep' },
};
export const catGroups = Object.keys(categories);

// Tăng độ đậm màu (saturation) cho mọi màu của mèo; màu gần như không sắc (trắng, xám) gần như giữ nguyên.
const SATURATION = 1.35;
function saturate(hex, factor = SATURATION) {
  let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return hex;
  let s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6; s = Math.min(1, s * factor);
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const hue = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return '#' + [h + 1 / 3, h, h - 1 / 3].map(t => Math.round(hue(t) * 255).toString(16).padStart(2, '0')).join('');
}
for (const cat of Object.values(categories)) {
  for (const key of ['color', 'fur', 'side', 'stripe', 'belly', 'paw', 'eye', 'mask']) if (cat[key]) cat[key] = saturate(cat[key]);
}

const BODY = 'M8 60 Q8 30 30 27 L70 27 Q92 30 92 60 L92 78 Q92 91 78 91 L22 91 Q8 91 8 78Z';
// Tai trái [viền ngoài, lòng tai]; tai phải được lật gương.
const EARS = {
  pointy: ['M12 46 L17 8 L44 29Z', 'M20 35 L22 17 L35 28Z'],
  round: ['M11 44 C6 20 20 8 31 13 C39 17 43 24 44 29Z', 'M18 35 C15 22 23 16 30 19 C35 22 37 26 37 29Z'],
  tall: ['M13 44 L15 0 L42 28Z', 'M20 34 L19 11 L33 27Z'],
  small: ['M16 40 L23 15 L40 29Z', 'M22 33 L25 22 L33 29Z'],
  wide: ['M7 48 L9 11 L46 29Z', 'M15 37 L16 19 L36 29Z'],
  fold: ['M12 38 C11 22 26 15 42 27 C36 33 22 38 12 38Z', 'M18 33 C20 26 28 23 35 27 C30 31 24 33 18 33Z'],
};

function shade(hex, amount) {
  const target = amount > 0 ? 255 : 0, mix = Math.abs(amount);
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - mix) + target * mix).toString(16).padStart(2, '0')).join('');
}

function openEye(cat, x) {
  const c = cat.eye;
  switch (cat.eyeStyle) {
    case 'sparkle': return `<circle cx="${x}" cy="57" r="6.8" fill="${c}"/><circle cx="${x + 2.2}" cy="54.6" r="2.4" fill="#fff"/><circle cx="${x - 2}" cy="59.6" r="1.1" fill="#fff"/>`;
    case 'dot': return `<circle cx="${x}" cy="57" r="4.4" fill="${c}"/><circle cx="${x + 1.4}" cy="55.6" r="1.4" fill="#fff"/>`;
    case 'oval': return `<ellipse cx="${x}" cy="57" rx="4.6" ry="6.6" fill="${c}"/><ellipse cx="${x + 1.6}" cy="54.4" rx="1.6" ry="2.1" fill="#fff"/>`;
    case 'slit': return `<ellipse cx="${x}" cy="57" rx="6.4" ry="5.8" fill="${c}"/><ellipse cx="${x}" cy="57" rx="1.7" ry="5" fill="#1d1b1e"/><circle cx="${x + 2.4}" cy="55" r="1.5" fill="#fff"/>`;
    default: return `<circle cx="${x}" cy="57" r="6.5" fill="${c}"/><circle cx="${x}" cy="57.5" r="3.6" fill="#1d1b1e"/><circle cx="${x + 2}" cy="54.6" r="1.8" fill="#fff"/>`;
  }
}
const closedEye = (x, ink) => `<path d="M${x - 6} 58 Q${x} 51 ${x + 6} 58" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
const starEye = (x, color) => `<path d="M${x} 50 L${x + 2} 55 L${x + 7} 57 L${x + 2} 59 L${x} 64 L${x - 2} 59 L${x - 7} 57 L${x - 2} 55Z" fill="${color}" stroke="#fff" stroke-width=".8"/>`;

function face(cat, group, mood, ink) {
  const lineInk = group === 'tuxedo' ? '#f3e7cf' : ink;
  const eyes = {
    happy: closedEye(37, lineInk) + closedEye(63, lineInk),
    wink: openEye(cat, 37) + closedEye(63, lineInk),
    sparkly: starEye(37, cat.eyeStyle === 'dot' || cat.eyeStyle === 'oval' ? '#f2b53c' : cat.eye) + starEye(63, cat.eyeStyle === 'dot' || cat.eyeStyle === 'oval' ? '#f2b53c' : cat.eye),
  }[mood] || openEye(cat, 37) + openEye(cat, 63);
  const mouth = {
    happy: `<path d="M44 68 Q50 76 56 68Z" fill="#b8475a" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
    grin: `<path d="M42.5 68 Q50 79 57.5 68Z" fill="#b8475a" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M46 72.5 Q50 76.5 54 72.5" fill="#f28ba0"/>`,
    blep: `<path d="M44.5 68.5 Q47.2 72 50 68.8 Q52.8 72 55.5 68.5" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/><path d="M47.3 70.2 Q47.3 76 50 76 Q52.7 76 52.7 70.2Z" fill="#f28ba0" stroke="#d9637b" stroke-width=".8"/>`,
  }[mood] || `<path d="M44.5 68.5 Q47.2 72 50 68.8 Q52.8 72 55.5 68.5" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  // Mắt nhắm sẵn (happy) thì không cần chớp.
  return `<g class="eyes${mood === 'happy' ? ' no-blink' : ''}">${eyes}</g>${mouth}`;
}

function catSvg(group) {
  const cat = categories[group], id = `cat-${group}`, mood = cat.mood;
  const ink = cat.mask || group === 'tuxedo' ? '#2a1d18' : '#4a3030';
  const [earOuter, earInner] = EARS[cat.ears];
  const mirror = 'transform="matrix(-1 0 0 1 100 0)"';
  const earFill = cat.mask || `url(#${id}-fur)`;
  const innerFill = cat.mask ? '#b88a78' : '#f6a8b4';
  const stripes = cat.stripe ? `<g stroke="${cat.stripe}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9">
      <path d="M44 31v8M50 30v10M56 31v8M9 56h8M9 64h6M91 56h-8M91 64h-6"/></g>` : '';
  const ears = `<g stroke="${shade(cat.mask || cat.fur, .1)}" stroke-width="5" stroke-linejoin="round">
      <path d="${earOuter}" fill="${earFill}"/><path d="${earOuter}" fill="${earFill}" ${mirror}/></g>
    <path d="${earInner}" fill="${innerFill}"/><path d="${earInner}" fill="${innerFill}" ${mirror}/>`;
  // Thân dưới lúc bị nhấc bổng: bụng + 2 chân sau lủng lẳng + đuôi. Mặc định ẩn (visibility là presentation
  // attribute nên CSS của từng chế độ có thể bật lên).
  const leg = cat.mask || cat.fur;
  const hang = `<g class="hang" visibility="hidden">
      <path d="M78 104 Q98 112 93 132" fill="none" stroke="${shade(leg, -.08)}" stroke-width="7" stroke-linecap="round"/>
      <path d="M17 72 L83 72 Q88 102 75 122 Q50 131 25 122 Q12 102 17 72Z" fill="url(#${id}-fur)" stroke="${shade(cat.fur, -.12)}" stroke-width="2"/>
      <ellipse cx="50" cy="104" rx="19" ry="16" fill="${cat.belly}"/>
      <g fill="${leg}" stroke="${shade(leg, -.15)}" stroke-width="1.5">
        <rect x="27" y="112" width="15" height="22" rx="7.5"/><rect x="58" y="112" width="15" height="22" rx="7.5"/></g>
      <ellipse cx="34.5" cy="132" rx="7.5" ry="5" fill="${cat.paw}"/><ellipse cx="65.5" cy="132" rx="7.5" ry="5" fill="${cat.paw}"/>
      <g fill="#f4a3b3"><ellipse cx="34.5" cy="133" rx="3" ry="2"/><ellipse cx="65.5" cy="133" rx="3" ry="2"/>
        <circle cx="30.5" cy="130" r="1.3"/><circle cx="34.5" cy="129" r="1.3"/><circle cx="38.5" cy="130" r="1.3"/>
        <circle cx="61.5" cy="130" r="1.3"/><circle cx="65.5" cy="129" r="1.3"/><circle cx="69.5" cy="130" r="1.3"/></g>
    </g>`;
  return `<svg class="cat mood-${mood}" viewBox="0 0 100 106" aria-hidden="true">
    <defs>
      <radialGradient id="${id}-fur" cx=".36" cy=".3" r=".85">
        <stop offset="0" stop-color="${shade(cat.fur, .28)}"/><stop offset=".55" stop-color="${cat.fur}"/><stop offset="1" stop-color="${shade(cat.fur, -.2)}"/>
      </radialGradient>
      <linearGradient id="${id}-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${cat.side}"/><stop offset="1" stop-color="${shade(cat.side, -.3)}"/>
      </linearGradient>
    </defs>
    <ellipse class="ground" cx="50" cy="101" rx="40" ry="5" fill="#10240b" opacity=".22"/>
    ${cat.ears === 'fold' ? '' : ears}
    ${hang}
    <path class="base" d="${BODY}" transform="translate(0 9)" fill="url(#${id}-side)" stroke="url(#${id}-side)" stroke-width="6" stroke-linejoin="round"/>
    <path d="${BODY}" fill="url(#${id}-fur)" stroke="${shade(cat.fur, .1)}" stroke-width="6" stroke-linejoin="round"/>
    ${cat.ears === 'fold' ? ears : ''}
    ${stripes}
    ${cat.muzzle ? `<path d="M50 50 C66 50 76 62 76 76 L76 91 L24 91 L24 76 C24 62 34 50 50 50Z" fill="${cat.belly}"/>` : `<ellipse cx="50" cy="80" rx="24" ry="11" fill="${cat.belly}" opacity=".9"/>`}
    ${cat.mask ? `<ellipse cx="50" cy="63" rx="19" ry="14" fill="${cat.mask}" opacity=".85"/>` : ''}
    <path d="M8 70 Q8 90 22 91 L78 91 Q92 90 92 70 Q92 86 78 88 L22 88 Q8 86 8 70Z" fill="#000" opacity=".1"/>
    <ellipse cx="26" cy="67" rx="6" ry="3.4" fill="#ff8fa0" class="blush"/><ellipse cx="74" cy="67" rx="6" ry="3.4" fill="#ff8fa0" class="blush"/>
    <g class="calm">${face(cat, group, mood, ink)}</g>
    <g class="annoyed" fill="none" stroke="${group === 'tuxedo' ? '#f3e7cf' : ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M31 52 L40 57 L31 62M69 52 L60 57 L69 62"/>
      <path d="M43 72 Q46.5 68 50 71.5 Q53.5 68 57 72" stroke="${ink}" stroke-width="2"/>
      <path d="M84 30 Q88 37 84 40 Q80 37 84 30Z" fill="#9fdcf7" stroke="#5fb4dd" stroke-width="1.2"/>
    </g>
    <path d="M46.8 63.5 L53.2 63.5 L50 67Z" fill="#ef8595"/>
    <g stroke="${cat.side}" stroke-width="1.5">
      <ellipse cx="33" cy="91" rx="10" ry="6.5" fill="${cat.paw}"/><ellipse cx="67" cy="91" rx="10" ry="6.5" fill="${cat.paw}"/>
      <path d="M30 88v4M36 88v4M64 88v4M70 88v4" stroke-linecap="round" opacity=".6"/>
    </g>
    <ellipse cx="30" cy="37" rx="11" ry="4.5" fill="#fff" opacity=".35" transform="rotate(-12 30 37)"/>
    <path d="M14 46 Q12 58 13 68" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".25"/>
  </svg>`;
}

export const catMarkup = Object.fromEntries(catGroups.map(group => [group, catSvg(group)]));

export function addArt(element, group) {
  element.title = categories[group].name;
  element.insertAdjacentHTML('beforeend', catMarkup[group]);
  // Mỗi con chớp mắt lệch nhịp nhau.
  element.style.setProperty('--blink-delay', `-${(Math.random() * 6).toFixed(2)}s`);
  element.style.setProperty('--blink-dur', `${(4 + Math.random() * 3).toFixed(2)}s`);
}
