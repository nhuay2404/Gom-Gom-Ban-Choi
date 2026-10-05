// Art mèo dùng chung cho các chế độ Gom Gom: 6 loại, vẽ bằng SVG.
// Mỗi loại có tai, kiểu mắt và một biểu cảm (mood) riêng, không loại nào trùng loại nào.
export const categories = {
  orange: { name: 'Orange cat', color: '#f39a45', fur: '#f5a04e', side: '#c9702a', stripe: '#d9772f', belly: '#ffe3bf', paw: '#ffe3bf', eye: '#3a2a22', ears: 'pointy', eyeStyle: 'sparkle', mood: 'grin' },
  gray: { name: 'Gray cat', color: '#a9adb5', fur: '#aeb2ba', side: '#7c818b', stripe: '#6c717a', belly: '#f6f6f4', paw: '#f6f6f4', eye: '#3a3a3a', ears: 'round', eyeStyle: 'dot', mood: 'happy' },
  white: { name: 'White cat', color: '#f4efe8', fur: '#fbf8f3', side: '#d7cfc4', belly: '#fbf8f3', paw: '#fffdf9', eye: '#3a3030', ears: 'tall', eyeStyle: 'oval', mood: 'sparkly' },
  tuxedo: { name: 'Tuxedo cat', color: '#2f2c31', fur: '#322f35', side: '#1a181c', belly: '#fbf8f3', muzzle: true, paw: '#fbf8f3', eye: '#e8b53a', ears: 'small', eyeStyle: 'slit', mood: 'wink' },
  siamese: { name: 'Siamese cat', color: '#e8d6bd', fur: '#efe0cb', side: '#c4ab8c', mask: '#6b4a3a', belly: '#f7ecdc', paw: '#6b4a3a', eye: '#4aa3e0', ears: 'wide', eyeStyle: 'iris', mood: 'smile' },
  tabby: { name: 'Tabby cat', color: '#9a7550', fur: '#a27c55', side: '#6f5236', stripe: '#5a4128', belly: '#e9d6b8', paw: '#e9d6b8', eye: '#7fae3a', ears: 'fold', eyeStyle: 'slit', mood: 'blep' },
};
export const catGroups = Object.keys(categories);

// Tăng độ đậm màu (saturation) cho mọi màu của mèo; màu gần như không sắc (trắng, xám) gần như giữ nguyên.
const SATURATION = 1.7;
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

// Riêng đôi mắt (SVG, cùng hệ toạ độ 100×106 với art trên bàn chơi) cho mèo 3D trong phòng Deco,
// để mắt 3D giống hệt mèo 2D: cùng kiểu mắt từng giống và cùng biểu cảm mặc định (xám nhắm cười, trắng mắt sao, mun nháy mắt).
//   open    = mắt mặc định trên bàn chơi      focus  = mắt mở đúng kiểu của giống, to hơn chút
//   blink   = mắt ép dẹt (như anim chớp 2D)    half   = lim dim
//   sleep   = mắt buồn ngủ khi AFK             happy  = mắt ^^ khi gom     annoyed = mắt > < khi bị nhấc
export function eyesMarkup(group, kind = 'open') {
  const cat = categories[group];
  const ink = cat.mask || group === 'tuxedo' ? '#2a1d18' : '#4a3030';
  const line = group === 'tuxedo' ? '#f3e7cf' : ink;
  const stroke = (d, width) => `<path d="${d}" fill="none" stroke="${line}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const squash = (markup, sy) => `<g transform="translate(0 57) scale(1 ${sy}) translate(0 -57)">${markup}</g>`;
  const both = eye => eye(37) + eye(63);
  const calm = face(cat, group, cat.mood, ink).match(/<g class="eyes[^"]*">([\s\S]*?)<\/g>/)[1];
  const open = both(x => openEye(cat, x));
  switch (kind) {
    case 'focus': return [37, 63].map(x => `<g transform="translate(${x} 57) scale(1.18) translate(${-x} -57)">${openEye(cat, x)}</g>`).join('');
    case 'blink': return cat.mood === 'happy' ? calm : squash(calm, .08);
    case 'half': return cat.mood === 'happy' ? calm : squash(calm, .5) + stroke('M30 54.5 L44 54.5M56 54.5 L70 54.5', 2.4);
    case 'sleep': return stroke('M31 58 Q37 63.5 43 58M57 58 Q63 63.5 69 58', 3);
    case 'happy': return stroke('M30 59 Q37 49 44 59M56 59 Q63 49 70 59', 3.2);
    case 'annoyed': return stroke('M31 52 L40 57 L31 62M69 52 L60 57 L69 62', 3);
    default: return calm;
  }
}

// Biểu cảm khi sắp hết lượt: mỗi con một kiểu (JS gắn data-low trên mèo để chọn). Mặc định ẩn.
// Khi người chơi AFK thì mọi con đều buồn ngủ (sleepy, gắn body.afk).
export const LOW_MOVE_MOODS = ['sad', 'worried', 'crying', 'disappointed', 'sulky'];
function afkFaces(cat, group, ink) {
  const line = group === 'tuxedo' ? '#f3e7cf' : ink;
  const stroke = `fill="none" stroke="${line}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;
  const eyes = openEye(cat, 37) + openEye(cat, 63);
  const frown = `<path d="M43 73 Q50 67 57 73" ${stroke}/>`;
  const tear = (x, delay) => `<path class="afk-tear" style="animation-delay:${delay}s" d="M${x} 63 Q${x + 3} 67 ${x} 69.5 Q${x - 3} 67 ${x} 62Z" fill="#8fd3f7" stroke="#4fa9d9" stroke-width=".8"/>`;
  return {
    // Buồn ngủ: mắt nhắm lim dim (vòng cung úp xuống), miệng tròn ngáp nhỏ, chữ z bay lên.
    sleepy: `<path d="M31 58 Q37 63.5 43 58M57 58 Q63 63.5 69 58" ${stroke} stroke-width="3"/>
      <ellipse cx="50" cy="72" rx="3.4" ry="3" fill="#b8475a" stroke="${line}" stroke-width="1.6"/>
      <g class="afk-z" fill="none" stroke="#7a8fd6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M76 26 h8 l-8 9 h8"/><path class="z2" d="M86 12 h6 l-6 7 h6"/></g>`,
    // Buồn: mày xụ, mắt rưng rưng (giọt lệ đọng), miệng mếu.
    sad: `<path d="M29 48 L41 45M71 48 L59 45" ${stroke}/>${eyes}
      <ellipse cx="37" cy="63" rx="4" ry="1.8" fill="#bfe8ff" opacity=".9"/><ellipse cx="63" cy="63" rx="4" ry="1.8" fill="#bfe8ff" opacity=".9"/>${frown}`,
    // Lo lắng: mày nhướng chữ bát, miệng méo zigzag, giọt mồ hôi.
    worried: `<path d="M30 46 Q35 43 41 47M70 46 Q65 43 59 47" ${stroke}/>${eyes}
      <path d="M42 72 L45.5 70 L49 72.5 L52 70 L55.5 72.5 L58 71" ${stroke} stroke-width="2"/>
      <path class="afk-sweat" d="M82 36 Q87 44 82 47 Q77 44 82 36Z" fill="#9fdcf7" stroke="#5fb4dd" stroke-width="1.2"/>`,
    // Khóc: mắt to long lanh ngấn nước (tròng đen lớn, nhiều đốm sáng lấp lánh, vũng nước mắt đọng mí dưới),
    // mày xụ, miệng mếu nhỏ, nước mắt lăn từ khoé mắt.
    crying: `<path d="M29 46 L40 43M71 46 L60 43" ${stroke}/>
      ${[37, 63].map(x => `
      <circle cx="${x}" cy="57" r="8.2" fill="#2b2230"/>
      <circle cx="${x}" cy="58.5" r="6.4" fill="url(#cry-iris)"/>
      <path d="M${x - 7.6} 60 Q${x} 67.5 ${x + 7.6} 60 Q${x} 64 ${x - 7.6} 60Z" fill="#9fdcff" opacity=".85"/>
      <circle class="afk-glint" cx="${x + 2.8}" cy="53.8" r="2.9" fill="#fff"/>
      <circle class="afk-glint b" cx="${x - 3}" cy="59.6" r="1.5" fill="#fff"/>
      <circle class="afk-glint c" cx="${x + 3.6}" cy="60.5" r=".9" fill="#fff"/>`).join('')}
      <path d="M44 72.5 Q47 69.5 50 72 Q53 69.5 56 72.5" ${stroke} stroke-width="2"/>
      ${tear(30.5, 0)}${tear(69.5, -.45)}${tear(33, -.9)}${tear(67, -1.2)}`,
    // Thất vọng: mí mắt sụp nửa chừng, liếc xuống, miệng thẳng.
    disappointed: `<path d="M32 55 A5 5 0 0 0 42 55Z M58 55 A5 5 0 0 0 68 55Z" fill="${cat.eye}"/>
      <path d="M30 55 L44 55M56 55 L70 55" ${stroke} stroke-width="3"/>
      <path d="M44 71 L56 71" ${stroke}/>`,
    // Dỗi: mắt -_-, má phồng, gân giận nhỏ.
    sulky: `<path d="M31 57 L43 57M57 57 L69 57" ${stroke} stroke-width="3"/>
      <path d="M45 71 Q50 68.5 55 71" ${stroke}/>
      <path d="M80 22 l4 4 m0 -4 l-4 4 M86 26 l3 3" stroke="#e2574c" stroke-width="2.2" stroke-linecap="round"/>`,
  };
}

// Viền giống viền toon của mèo 3D ở Home (OUTLINE_STYLES.default.brown trong deco/toon.mjs).
const TOON_INK = '#4a2c1f';
function catSvg(group) {
  const cat = categories[group], id = `cat-${group}`, mood = cat.mood;
  const ink = cat.mask || group === 'tuxedo' ? '#2a1d18' : '#4a3030';
  const [earOuter, earInner] = EARS[cat.ears];
  const mirror = 'transform="matrix(-1 0 0 1 100 0)"';
  const earFill = cat.mask || cat.fur;
  const innerFill = cat.mask ? '#b88a78' : '#f6a8b4';
  const stripes = cat.stripe ? `<g stroke="${cat.stripe}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9">
      <path d="M44 31v8M50 30v10M56 31v8M9 56h8M9 64h6M91 56h-8M91 64h-6"/></g>` : '';
  const ears = `<g stroke="${TOON_INK}" stroke-width="3" stroke-linejoin="round">
      <path d="${earOuter}" fill="${earFill}"/><path d="${earOuter}" fill="${earFill}" ${mirror}/></g>
    <path d="${earInner}" fill="${innerFill}"/><path d="${earInner}" fill="${innerFill}" ${mirror}/>`;
  // Thân dưới lúc bị nhấc bổng: bụng + 2 chân sau lủng lẳng + đuôi. Mặc định ẩn (visibility là presentation
  // attribute nên CSS của từng chế độ có thể bật lên).
  const leg = cat.mask || cat.fur;
  const hang = `<g class="hang" visibility="hidden">
      <path d="M78 104 Q98 112 93 132" fill="none" stroke="${TOON_INK}" stroke-width="10" stroke-linecap="round"/>
      <path d="M78 104 Q98 112 93 132" fill="none" stroke="${shade(leg, -.08)}" stroke-width="6.4" stroke-linecap="round"/>
      <path d="M17 72 L83 72 Q88 102 75 122 Q50 131 25 122 Q12 102 17 72Z" fill="${cat.fur}" stroke="${TOON_INK}" stroke-width="2"/>
      <ellipse cx="50" cy="104" rx="19" ry="16" fill="${cat.belly}"/>
      <g fill="${leg}" stroke="${TOON_INK}" stroke-width="2">
        <rect x="27" y="112" width="15" height="22" rx="7.5"/><rect x="58" y="112" width="15" height="22" rx="7.5"/></g>
      <g stroke="${TOON_INK}" stroke-width="2"><ellipse cx="34.5" cy="132" rx="7.5" ry="5" fill="${cat.paw}"/><ellipse cx="65.5" cy="132" rx="7.5" ry="5" fill="${cat.paw}"/></g>
      <g fill="#f4a3b3"><ellipse cx="34.5" cy="133" rx="3" ry="2"/><ellipse cx="65.5" cy="133" rx="3" ry="2"/>
        <circle cx="30.5" cy="130" r="1.3"/><circle cx="34.5" cy="129" r="1.3"/><circle cx="38.5" cy="130" r="1.3"/>
        <circle cx="61.5" cy="130" r="1.3"/><circle cx="65.5" cy="129" r="1.3"/><circle cx="69.5" cy="130" r="1.3"/></g>
    </g>`;
  return `<svg class="cat mood-${mood}" viewBox="0 0 100 106" aria-hidden="true">
    <defs>
      <radialGradient id="cry-iris" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#6b5a86"/><stop offset=".6" stop-color="#3a2f4a"/><stop offset="1" stop-color="#241c2e"/></radialGradient>
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
    <path class="base" d="${BODY}" transform="translate(0 9)" fill="${cat.side}" stroke="${TOON_INK}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="${BODY}" fill="${cat.fur}" stroke="${TOON_INK}" stroke-width="2.8" stroke-linejoin="round"/>
    ${cat.ears === 'fold' ? ears : ''}
    ${stripes}
    ${cat.muzzle ? `<path d="M50 50 C66 50 76 62 76 76 L76 91 L24 91 L24 76 C24 62 34 50 50 50Z" fill="${cat.belly}"/>` : `<ellipse cx="50" cy="80" rx="24" ry="11" fill="${cat.belly}" opacity=".9"/>`}
    ${cat.mask ? `<ellipse cx="50" cy="63" rx="19" ry="14" fill="${cat.mask}" opacity=".85"/>` : ''}
    <ellipse cx="26" cy="67" rx="6" ry="3.4" fill="#ff8fa0" class="blush"/><ellipse cx="74" cy="67" rx="6" ry="3.4" fill="#ff8fa0" class="blush"/>
    <g class="calm">${face(cat, group, mood, ink)}</g>
    <g class="annoyed" fill="none" stroke="${group === 'tuxedo' ? '#f3e7cf' : ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M31 52 L40 57 L31 62M69 52 L60 57 L69 62"/>
      <path d="M43 72 Q46.5 68 50 71.5 Q53.5 68 57 72" stroke="${ink}" stroke-width="2"/>
      <path d="M84 30 Q88 37 84 40 Q80 37 84 30Z" fill="#9fdcf7" stroke="#5fb4dd" stroke-width="1.2"/>
    </g>
    ${Object.entries(afkFaces(cat, group, ink)).map(([name, svg]) => `<g class="afk afk-${name}" visibility="hidden">${svg}</g>`).join('')}
    <g class="joy" visibility="hidden">
      <g fill="none" stroke="${group === 'tuxedo' ? '#f3e7cf' : ink}" stroke-width="3.2" stroke-linecap="round">
        <path d="M30 59 Q37 49 44 59M56 59 Q63 49 70 59"/></g>
      <path d="M40 67 Q50 83 60 67Z" fill="#b8475a" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M44.5 73 Q50 79 55.5 73" fill="#f28ba0"/>
      <ellipse cx="25" cy="67" rx="7.5" ry="4.2" fill="#ff7f96" opacity=".75"/><ellipse cx="75" cy="67" rx="7.5" ry="4.2" fill="#ff7f96" opacity=".75"/>
      <g fill="#ffd84d" stroke="#fff" stroke-width=".8">
        <path d="M11 30 L13 35 L18 37 L13 39 L11 44 L9 39 L4 37 L9 35Z"/><path d="M90 24 L91.5 28 L95.5 29.5 L91.5 31 L90 35 L88.5 31 L84.5 29.5 L88.5 28Z"/></g>
    </g>
    <path d="M46.8 63.5 L53.2 63.5 L50 67Z" fill="#ef8595"/>
    <g stroke="${TOON_INK}" stroke-width="1.8">
      <ellipse cx="33" cy="91" rx="10" ry="6.5" fill="${cat.paw}"/><ellipse cx="67" cy="91" rx="10" ry="6.5" fill="${cat.paw}"/>
      <path d="M30 88v4M36 88v4M64 88v4M70 88v4" stroke-linecap="round" stroke-width="1.6" opacity=".55"/>
    </g>
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
