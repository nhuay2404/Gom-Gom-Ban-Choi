// 120 frames: pour 0–83, close cap 85–108, settle 109–119.
const SHEET = 'assets/img/board/syrup-bottle-close-60fps.png';
export const CLOSED_BOTTLE = '<img src="assets/img/board/syrup-bottle-closed.png" alt="" draggable="false" style="height:100%">';
export const POUR_MS = 2000;
const image = new Image();
image.src = SHEET;
const ready = image.decode().then(() => true, () => false);
// Top edge of the liquid in each frame (px inside the 192×320 frame; 156 = bottle mouth), measured from the sheet's alpha.
// shortcut: hand-measured, re-measure if the sheet is redrawn.
const SURFACE_TOPS = [...Array(27).fill(21), 22, 23, 24, 25, 27, 28, 30, 33, 35, 38, 40, 43, 46, 50, 53, 56, 60, 64, 68, 72, 76, 80, 84,
  88, 92, 96, 101, 105, 109, 113, 118, 122, 126, 130, 134, 138, 142, 146, 150, 153, 156];
const surfaceAt = frame => (SURFACE_TOPS[Math.min(frame, SURFACE_TOPS.length - 1)] - 16) / 128;
const clamp = value => Math.max(0, Math.min(1, value));

// How far down the pet (0..1) is uncovered at frame i. The pet stands taller than its cell, so its head would poke above the still-full
// syrup tile: the head wipes in 3× faster than the surface sinks until the line catches the surface, then follows it exactly (no board
// gap above the stream). Once the liquid has gone into the bottle the rest of the pet shows.
export function revealLine(i, box, pet) {
  if (i >= SURFACE_TOPS.length - 1) return 1;
  const start = box.top + surfaceAt(0) * box.height, surface = box.top + surfaceAt(i) * box.height;
  return clamp((Math.min(surface, pet.top + (surface - start) * 3) - pet.top) / pet.height);
}

// Pet visible = above the reveal line, plus everything inside the cell box (the pour sprite drawn on top and the inverse-sprite mask
// hide what is still under syrup there). evenodd rings: whole pet, minus below the line, plus the cell box below the line.
export function petRevealFrames(box, pet) {
  const pct = (v, from, size) => `${((v - from) / size * 100).toFixed(2)}%`;
  const bl = pct(box.left, pet.left, pet.width), br = pct(box.left + box.width, pet.left, pet.width);
  return Array.from({ length: 121 }, (_, i) => {
    const line = pet.top + revealLine(i, box, pet) * pet.height;
    // cell box re-shown only once the liquid moves, and a corner radius below its surface: the tile's rounded corners would show the pet
    const surface = box.top + (surfaceAt(i) + .1) * box.height;
    const top = surfaceAt(i) > surfaceAt(0) ? Math.min(Math.max(line, surface), box.top + box.height) : box.top + box.height;
    const l = pct(line, pet.top, pet.height), t = pct(top, pet.top, pet.height), b = pct(box.top + box.height, pet.top, pet.height);
    const rings = [
      '0% 0%', '100% 0%', '100% 100%', '0% 100%', '0% 0%',
      `0% ${l}`, `100% ${l}`, '100% 100%', '0% 100%', `0% ${l}`,
      `${bl} ${t}`, `${br} ${t}`, `${br} ${b}`, `${bl} ${b}`, `${bl} ${t}`,
      `0% ${l}`, '0% 0%',
    ];
    return { offset: i / 120, clipPath: `polygon(evenodd, ${rings.join(', ')})`, easing: 'steps(1, end)' };
  });
}

export async function playSyrupPour(cell, ghost, active = () => true) {
  const loaded = await ready;
  if (!cell.isConnected || !active() || !loaded) {
    ghost?.remove();
    delete cell.dataset.syrupPour;
    return;
  }
  const box = cell.getBoundingClientRect(), sx = box.width / 128, sy = box.height / 128;
  const sprite = document.createElement('span');
  sprite.className = 'syrup-pour-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = `position:fixed;pointer-events:none;z-index:60;background-color:transparent;left:${box.left - 32 * sx}px;top:${box.top - 16 * sy}px;width:${192 * sx}px;height:${320 * sy}px;background-size:${2304 * sx}px ${3200 * sy}px;background-repeat:no-repeat`;
  sprite.style.backgroundImage = `url("${SHEET}")`;
  const timing = { duration: POUR_MS, fill: 'both', easing: 'linear' };
  const animations = [];
  // Only pets are clipped. Grass, empty slots and the board underlay stay untouched.
  const pets = [...cell.querySelectorAll(':scope > .cat, :scope > .fat-cat')];
  pets.forEach(pet => {
    const rect = pet.getBoundingClientRect();
    animations.push(pet.animate(petRevealFrames(box, rect), timing));
    // Mask = pet minus the current sprite frame, so the pet shows wherever the syrup has already drained (no board gap beside the
    // stream). The pet faces the screen, so its local px map to screen px by one scale factor.
    const k = rect.width / (pet.clientWidth || rect.width), dx = (box.left - 32 * sx - rect.left) / k, dy = (box.top - 16 * sy - rect.top) / k;
    Object.assign(pet.style, { maskImage: `linear-gradient(#000 0 0), url("${SHEET}")`, maskRepeat: 'no-repeat', maskComposite: 'exclude',
      maskSize: `100% 100%, ${2304 * sx / k}px ${3200 * sy / k}px` });
    animations.push(pet.animate(Array.from({ length: 121 }, (_, i) => {
      const frame = Math.min(i, 119);
      return { offset: i / 120, maskPosition: `0 0, ${dx - (frame % 12) * 192 * sx / k}px ${dy - Math.floor(frame / 12) * 320 * sy / k}px`, easing: 'steps(1, end)' };
    }), timing));
  });
  cell.dataset.syrupPour = 'flow';
  document.body.append(sprite);
  ghost?.remove();
  const frames = Array.from({ length: 121 }, (_, i) => {
    const frame = Math.min(i, 119);
    return { offset: i / 120, backgroundPosition: `${-(frame % 12) * 192 * sx}px ${-Math.floor(frame / 12) * 320 * sy}px`, easing: 'steps(1, end)' };
  });
  const pour = sprite.animate(frames, timing);
  animations.push(pour);
  // One clock prevents the pet reveal from getting ahead of the liquid sprite.
  const start = document.timeline.currentTime;
  animations.forEach(animation => { animation.startTime = start; });
  try {
    await pour.finished;
  } finally {
    animations.forEach(animation => animation.cancel());
    pets.forEach(pet => Object.assign(pet.style, { maskImage: '', maskRepeat: '', maskComposite: '', maskSize: '' }));
    sprite.remove();
    delete cell.dataset.syrupPour;
  }
}
