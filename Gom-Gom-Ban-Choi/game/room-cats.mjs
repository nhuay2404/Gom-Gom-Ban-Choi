// Mèo khối 3D sống trong phòng Deco/Home.
// Mỗi con là một khối bo tròn (giống mèo trên bàn chơi) có tai, 4 chân, đuôi nhiều đốt và mặt vẽ bằng canvas.
// "Não" của mỗi con là một generator: mỗi frame chạy tiếp một nhịp, nên hành vi viết tuần tự như kịch bản
// (đi tới -> nhảy lên -> xoay vòng -> nằm ngủ ...) mà vẫn ngắt được bất cứ lúc nào (cưng mèo, AFK, dời đồ).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { categories, eyesMarkup } from './cat-art.mjs';
import { OBSTACLE_RADIUS, WINDOW } from './room-layout.mjs';
import { CAT_BODY, CAT_MOTION } from './tuning.mjs';

const { W, H, D, LEG } = CAT_BODY, ROOM = CAT_MOTION.ROOM_LIMIT, TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
// Lò xo tắt dần: obj[key] chạy về đích với độ cứng k và tỉ lệ tắt zeta (vận tốc lưu ở obj[key + 'V']).
// zeta < 1 thì hơi vọt qua rồi về, như thịt mềm; đây là thứ làm chuyển động hết "cứng".
function spring(obj, key, target, k, zeta, dt) {
  const vKey = key + 'V', v = obj[vKey] || 0;
  const accel = k * (target - obj[key]) - 2 * zeta * Math.sqrt(k) * v;
  obj[vKey] = v + accel * dt;
  obj[key] += obj[vKey] * dt;
}
// Lò xo từng tư thế, độ cao khi bị nhấc, sải bước: tuning.mjs (CAT_MOTION).
const { POSE_SPRING, CARRY_H, STRIDE_WALK, STRIDE_RUN } = CAT_MOTION;

// Bán kính vật cản của từng món + cửa sổ: room-layout.mjs.
const FURNITURE = Object.fromEntries(Object.entries(OBSTACLE_RADIUS).map(([id, r]) => [id, { r }]));

// ---------- Mặt mèo: vẽ bằng canvas, tách lớp "mặt" (bụng, mõm, miệng) và lớp "mắt" để mắt liếc được ----------
const textures = {};
function canvasTexture(key, draw) {
  if (textures[key]) return textures[key];
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 230;
  const g = canvas.getContext('2d');
  g.scale(256, 230);
  g.lineCap = g.lineJoin = 'round';
  draw(g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return (textures[key] = texture);
}
const ellipse = (g, x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = fill; g.fill(); };
function faceTexture(breed, mouth) {
  return canvasTexture(`face:${breed}:${mouth}`, g => {
    const cat = categories[breed];
    if (cat.mask) { g.globalAlpha = .9; ellipse(g, .5, .58, .4, .32, cat.mask); g.globalAlpha = 1; }
    if (cat.muzzle) { g.beginPath(); g.moveTo(.2, 1); g.bezierCurveTo(.22, .5, .78, .5, .8, 1); g.fillStyle = cat.belly; g.fill(); }
    else { g.globalAlpha = .9; ellipse(g, .5, .95, .32, .13, cat.belly); g.globalAlpha = 1; }
    if (cat.stripe) {
      g.strokeStyle = cat.stripe; g.lineWidth = .04;
      [.4, .5, .6].forEach(x => { g.beginPath(); g.moveTo(x, .03); g.lineTo(x, x === .5 ? .19 : .15); g.stroke(); });
      [.42, .54].forEach(y => { g.beginPath(); g.moveTo(-.01, y); g.lineTo(.08, y); g.moveTo(1.01, y); g.lineTo(.92, y); g.stroke(); });
    }
    g.globalAlpha = .55; ellipse(g, .19, .64, .075, .045, '#ff8fa0'); ellipse(g, .81, .64, .075, .045, '#ff8fa0'); g.globalAlpha = 1;
    g.beginPath(); g.moveTo(.465, .585); g.lineTo(.535, .585); g.lineTo(.5, .625); g.closePath(); g.fillStyle = '#ef8595'; g.fill();
    g.strokeStyle = '#4a3030'; g.lineWidth = .018;
    if (mouth === 'calm') { g.beginPath(); g.moveTo(.43, .66); g.quadraticCurveTo(.465, .71, .5, .665); g.quadraticCurveTo(.535, .71, .57, .66); g.stroke(); }
    if (mouth === 'open') { g.beginPath(); g.moveTo(.42, .655); g.quadraticCurveTo(.5, .82, .58, .655); g.closePath(); g.fillStyle = '#b8475a'; g.fill(); g.stroke(); ellipse(g, .5, .72, .04, .025, '#f28ba0'); }
    if (mouth === 'chew') { ellipse(g, .5, .69, .035, .032, '#b8475a'); ellipse(g, .5, .705, .02, .014, '#f28ba0'); }
    if (mouth === 'yawn') { ellipse(g, .5, .73, .075, .09, '#b8475a'); ellipse(g, .5, .78, .045, .03, '#f28ba0'); }
    if (mouth === 'zig') { g.beginPath(); g.moveTo(.42, .68); g.lineTo(.46, .655); g.lineTo(.5, .68); g.lineTo(.54, .655); g.lineTo(.58, .68); g.stroke(); }
  });
}
// Mắt: vẽ thẳng SVG mắt của mèo 2D (cat-art.mjs) lên canvas, nên mắt 3D giống hệt mèo trên bàn chơi.
// Khung nhìn 80×72 bắt đầu ở (10, 20) của art 2D = đúng vùng mặt, khớp vị trí mũi/má/miệng của lớp mặt.
const EYE_KINDS = ['open', 'focus', 'blink', 'half', 'sleep', 'happy', 'annoyed'];
function eyesTexture(breed, eyes) {
  const key = `eyes:${breed}:${eyes}`;
  if (textures[key]) return textures[key];
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 460;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textures[key] = texture;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 80 72" width="512" height="460" preserveAspectRatio="none">${eyesMarkup(breed, eyes)}</svg>`;
  const image = new Image();
  image.onload = () => { canvas.getContext('2d').drawImage(image, 0, 0, 512, 460); texture.needsUpdate = true; };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return texture;
}function zTexture() {
  return canvasTexture('zzz', g => {
    g.strokeStyle = '#7a8fd6'; g.lineWidth = .1;
    g.beginPath(); g.moveTo(.28, .25); g.lineTo(.72, .25); g.lineTo(.28, .75); g.lineTo(.72, .75); g.stroke();
  });
}

// ---------- Bộ khung một con mèo ----------
function buildRig(breed) {
  EYE_KINDS.forEach(kind => eyesTexture(breed, kind)); // nạp sẵn mọi kiểu mắt: lần chớp đầu không bị trống
  const cat = categories[breed];
  const fur = new THREE.MeshStandardMaterial({ color: cat.fur, roughness: .75 });
  const accent = new THREE.MeshStandardMaterial({ color: cat.mask || cat.fur, roughness: .75 });
  const paw = new THREE.MeshStandardMaterial({ color: cat.paw, roughness: .8 });
  const earInner = new THREE.MeshStandardMaterial({ color: cat.mask ? '#b88a78' : '#f6a8b4', roughness: .8 });
  const mesh = (geometry, material, shadow = true) => { const m = new THREE.Mesh(geometry, material); m.castShadow = shadow; m.receiveShadow = true; return m; };

  const root = new THREE.Group();          // vị trí + hướng
  const hopper = new THREE.Group();        // nảy / nhún / run
  const roller = new THREE.Group();        // lăn nghiêng
  const pivot = new THREE.Group();         // chúi / ngửa quanh mép sau-dưới thân
  root.add(hopper); hopper.add(roller); roller.add(pivot);
  pivot.position.set(0, LEG, -D / 2);
  const body = mesh(new RoundedBoxGeometry(W, H, D, 6, .12), fur);
  body.position.set(0, H / 2, D / 2);
  pivot.add(body);

  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(breed, 'calm'), transparent: true, alphaTest: .02, depthWrite: false });
  const eyesMat = new THREE.MeshBasicMaterial({ map: eyesTexture(breed, 'open'), transparent: true, alphaTest: .02, depthWrite: false });
  const plane = new THREE.PlaneGeometry(W * .94, H * .94);
  const face = new THREE.Mesh(plane, faceMat), eyes = new THREE.Mesh(plane, eyesMat);
  face.position.set(0, H / 2, D + .003); eyes.position.set(0, H / 2, D + .006);
  pivot.add(face, eyes);

  const ears = [-1, 1].map(side => {
    const ear = new THREE.Group();
    const outer = mesh(new THREE.ConeGeometry(.1, .17, 4), accent);
    outer.rotation.y = Math.PI / 4;
    const inner = mesh(new THREE.ConeGeometry(.055, .11, 4), earInner, false);
    inner.rotation.y = Math.PI / 4; inner.position.set(0, -.02, .045);
    ear.add(outer, inner);
    ear.position.set(side * W * .3, H + .05, D * .72);
    ear.rotation.z = -side * .18;
    pivot.add(ear);
    return ear;
  });

  // Đuôi: chuỗi đốt, đốt sau là con của đốt trước để uốn cong mềm.
  const tail = [];
  let parent = pivot;
  for (let i = 0; i < 5; i++) {
    const joint = new THREE.Group();
    const r = .045 - i * .005;
    const seg = mesh(new THREE.CapsuleGeometry(r, .07, 6, 14), accent);
    seg.position.y = .05;
    joint.add(seg);
    if (i === 0) joint.position.set(0, H * .3, .02); else joint.position.y = .1;
    parent.add(joint);
    tail.push(joint);
    parent = joint;
  }

  // Chân: khớp ở trên, khối chân thò xuống; bàn chân màu riêng.
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const hip = new THREE.Group();
    hip.position.set(sx * W * .3, LEG + .03, sz * D * .3);
    const leg = mesh(new RoundedBoxGeometry(.14, LEG + .06, .14, 4, .05), cat.mask ? accent : fur);
    leg.position.y = -(LEG + .03) / 2;
    const foot = mesh(new RoundedBoxGeometry(.15, .05, .16, 4, .025), paw);
    foot.position.set(0, -(LEG + .03) + .025, .01);
    hip.add(leg, foot);
    // Gắn vào roller (cùng nhánh với thân): thân nghiêng / lắc / nảy thì chân theo, không choãi ra ngoài thân.
    roller.add(hip);
    return { hip, leg, foot, front: sz > 0 };
  });

  const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthWrite: false }));
  z.scale.set(.28, .25, 1); z.visible = false;
  root.add(z);
  root.traverse(node => { node.userData.catRoot = root; });
  return { root, hopper, roller, pivot, body, face, eyes, faceMat, eyesMat, ears, tail, legs, z };
}

// ---------- Một con mèo: thân thể + não ----------
class Cat {
  constructor(world, breed, x, z) {
    this.world = world;
    this.breed = breed;
    this.rig = buildRig(breed);
    this.x = x; this.z = z; this.y = 0;
    this.heading = rand(0, TAU); this.yaw = this.heading; // heading = hướng logic; yaw = hướng hiển thị bám theo bằng lò xo
    this.speed = 0; this.gait = rand(0, TAU); this.running = false;
    this.pose = { sit: 0, lie: 0, curl: 0, stretch: 0, roll: 0, lean: 0, paw: 0, groom: 0, knead: 0, tailUp: .4 };
    this.goal = { ...this.pose };
    this.mouth = 'calm'; this.eyes = 'open'; this.look = 0; this.lookGoal = 0;
    this.sleeping = false; this.surface = null; this.airY = 0; this.squash = 0;
    this.nextBlink = rand(1, 4); this.nextEar = rand(1, 5); this.earTwitch = 0; this.tailSpeed = 1.6; this.tailWag = .25;
    this.petUntil = 0; this.purr = 0; this.busyWith = null;
    this.move = 0; this.lid = 1; this.earFlop = 0; this.swayF = 0; this.swayL = 0; this.lean = 0; this.lastY = 0; this.airK = null; this.hopY = 0;
    this.tailZ = [0, 0, 0, 0, 0]; this.tailX = [0, 0, 0, 0, 0]; this.phase = rand(0, TAU);
    this.brain = this.life();
    this.rig.root.userData.cat = this;
    world.scene.add(this.rig.root);
  }
  dispose() { this.brain?.return(); this.world.scene.remove(this.rig.root); }

  // ----- Tư thế: đặt đích, thân tự chuyển mượt tới -----
  setPose(name, extra = {}) {
    const presets = {
      stand: {}, sit: { sit: 1 }, loaf: { lie: 1 }, curl: { lie: 1, curl: 1 }, crouch: { lie: .5 },
      stretch: { stretch: 1 }, roll: { lie: 1, roll: 1 }, knead: { sit: .5, knead: 1 },
    };
    const tailUp = this.goal.tailUp;
    this.goal = { sit: 0, lie: 0, curl: 0, stretch: 0, roll: 0, lean: 0, paw: 0, groom: 0, knead: 0, tailUp, ...presets[name], ...extra };
  }
  face(eyes, mouth = 'calm') { this.eyes = eyes; this.mouth = mouth; }
  interruptible() { return !this.busyWith && !this.sleeping && this.y < .01 && !this.social && !this.carried; }
  interrupt(brain) { const old = this.brain; this.brain = brain; old?.return(); }

  // ----- Các nhịp cơ bản (generator, yield = chờ frame sau) -----
  *wait(seconds) { for (let t = 0; t < seconds; t += this.world.dt) yield; }
  *turnTo(heading, rate = 5) {
    while (Math.abs(angDiff(this.heading, heading)) > .04) { this.turnToward(heading, rate); this.stepGait(.45); yield; }
    // chờ thân (yaw) quay kịp rồi mới làm việc tiếp, để không vừa quay vừa làm
    for (let t = 0; t < .4 && Math.abs(angDiff(this.yaw, this.heading)) > .08; t += this.world.dt) yield;
  }
  turnToward(heading, rate) {
    const diff = angDiff(this.heading, heading);
    this.heading += clamp(diff, -rate * this.world.dt, rate * this.world.dt);
  }
  facing(x, z) { return Math.atan2(x - this.x, z - this.z); }
  // Bước tại chỗ (lúc xoay người): nhịp chân chậm, chân nhấc thấp.
  stepGait(amount) { this.gait += this.world.dt * 7 * amount; this.shuffle = Math.max(this.shuffle || 0, amount); }

  *walkTo(tx, tz, { run = false, near = .08, ignore = null, maxTime = 8 } = {}) {
    this.setPose('stand', { tailUp: run ? .9 : this.goal.tailUp });
    this.running = run;
    let elapsed = 0;
    while (elapsed < maxTime) {
      const dt = this.world.dt;
      elapsed += dt;
      const dx = tx - this.x, dz = tz - this.z, dist = Math.hypot(dx, dz);
      if (dist < near) break;
      let vx = dx / dist, vz = dz / dist;
      // Tránh đồ đạc: đẩy ra khỏi vật cản + lách vòng theo tiếp tuyến.
      for (const ob of this.world.obstacles(ignore)) {
        const ox = this.x - ob.x, oz = this.z - ob.z, d = Math.hypot(ox, oz) || .001, reach = ob.r + .42;
        if (d < reach) {
          const push = (reach - d) / reach * 2.4;
          const side = Math.sign(vx * oz - vz * ox) || 1;
          vx += (ox / d) * push + (-oz / d) * side * push * .8;
          vz += (oz / d) * push + (ox / d) * side * push * .8;
        }
      }
      for (const other of this.world.cats) {
        if (other === this || other.y > .01) continue;
        const ox = this.x - other.x, oz = this.z - other.z, d = Math.hypot(ox, oz) || .001;
        if (d < .62 && other !== this.partner) { vx += (ox / d) * (.62 - d) * 3; vz += (oz / d) * (.62 - d) * 3; }
      }
      const want = Math.atan2(vx, vz);
      this.turnToward(want, run ? 9 : 6);
      const align = Math.max(0, Math.cos(angDiff(this.heading, want)));
      const top = run ? 2.1 : .72, slow = clamp(dist / .5, .35, 1);
      this.speed = damp(this.speed, top * align * slow, 6, dt);
      this.x = clamp(this.x + Math.sin(this.heading) * this.speed * dt, -ROOM, ROOM);
      this.z = clamp(this.z + Math.cos(this.heading) * this.speed * dt, -ROOM, ROOM);
      this.gait += (this.speed * dt / (run ? STRIDE_RUN : STRIDE_WALK)) * TAU;
      yield;
    }
    this.speed = 0; this.running = false;
  }

  // Nhảy: hạ người lấy đà (cao thì hạ sâu + lắc mông) -> vươn người bật lên -> bay parabol,
  // chân sau duỗi ra sau, chân trước vươn tới đón đất -> tiếp đất nhún nảy, tai cụp.
  *jumpTo(tx, ty, tz) {
    yield* this.turnTo(this.facing(tx, tz), 7);
    const x0 = this.x, y0 = this.y, z0 = this.z, rise = Math.max(0, ty - y0), drop = Math.max(0, y0 - ty);
    const dist = Math.hypot(tx - x0, tz - z0);
    this.setPose('crouch', { lie: .55 + Math.min(.3, rise * .18) });
    this.wriggle = rise > .6 ? 1 : 0;
    yield* this.wait(.24 + Math.min(.32, rise * .16));
    this.wriggle = 0;
    this.squash = -.45; this.squashV = 0; // vươn dài người lúc bật
    this.setPose('stand', { stretch: .3 });
    const duration = .36 + dist * .1 + rise * .11 + drop * .05, apex = .18 + rise * .28 + dist * .07;
    for (let t = 0; t < duration; t += this.world.dt) {
      const k = Math.min(1, t / duration), across = k * .75 + k * k * (3 - 2 * k) * .25;
      this.x = x0 + (tx - x0) * across; this.z = z0 + (tz - z0) * across;
      this.y = y0 + (ty - y0) * k + 4 * apex * k * (1 - k);
      this.airK = k;
      this.airPitch = -(.5 - k) * .95 * Math.sin(Math.PI * k); // ngửa lúc lên, chúi lúc xuống
      yield;
    }
    this.x = tx; this.y = ty; this.z = tz; this.airPitch = 0; this.airK = null;
    this.squash = .75 + Math.min(.4, drop * .2); this.squashV = 0; // tiếp đất: nhún rồi nảy lại
    this.earFlopV = (this.earFlopV || 0) + 14;
    this.setPose('stand');
    yield* this.wait(.24);
  }
  *getDown() {
    const from = this.surface ? this.world.center(this.surface) : { x: this.x, z: this.z, r: .6 };
    let dx = this.x - from.x, dz = this.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    if (len < .05) { dx = -this.x; dz = -this.z; }
    const l2 = Math.hypot(dx, dz) || 1;
    const out = (from.r || .6) + .45;
    const tx = clamp(from.x + (dx / l2) * out, -ROOM, ROOM), tz = clamp(from.z + (dz / l2) * out, -ROOM, ROOM);
    this.release();
    yield* this.jumpTo(tx, 0, tz);
    this.surface = null;
  }
  claim(key) { if (this.world.claims.get(key) && this.world.claims.get(key) !== this) return false; this.world.claims.set(key, this); this.busyWith = key; return true; }
  release() { // nhả mọi chỗ đang giữ (kể cả ghế mượn để ngắm cửa sổ)
    for (const [key, owner] of this.world.claims) if (owner === this) this.world.claims.delete(key);
    this.busyWith = null;
  }

  *lookAround(seconds) {
    for (let t = 0; t < seconds;) {
      const hold = rand(.6, 1.8);
      this.lookGoal = rand(-1, 1);
      if (chance(.3)) this.heading += rand(-.5, .5);
      yield* this.wait(hold); t += hold;
      if (chance(.2)) yield* this.slowBlink();
    }
    this.lookGoal = 0;
  }
  // Chớp mắt chậm: cách mèo nói "tớ tin cậu".
  *slowBlink() { const e = this.eyes; this.eyes = 'half'; yield* this.wait(.35); this.eyes = 'blink'; yield* this.wait(.5); this.eyes = 'half'; yield* this.wait(.3); this.eyes = e; }
  *sleep(seconds) {
    this.face('half'); yield* this.wait(1.2);
    this.face('sleep'); this.sleeping = true; this.tailWag = .05; this.tailSpeed = .5;
    try { yield* this.wait(seconds); } finally { this.sleeping = false; this.tailWag = .25; this.tailSpeed = 1.6; }
  }
  *yawnStretch() {
    this.setPose('stretch'); this.face('sleep', 'yawn');
    yield* this.wait(1.3);
    this.setPose('stand'); this.face('blink', 'calm');
    yield* this.wait(.25);
    this.face('open');
  }

  // ----- Hành vi -----
  *life() {
    let last = '';
    while (true) {
      if (this.y > .01) yield* this.getDown();
      const [name, behavior] = this.world.choose(this, last);
      last = name;
      try { yield* behavior; } finally { this.release(); this.social = null; this.partner = null; this.setPose('stand'); this.face('open'); this.lookGoal = 0; }
    }
  }
  *wander() {
    const p = this.world.freeSpot(this);
    this.goal.tailUp = rand(.5, 1);
    yield* this.walkTo(p.x, p.z);
    yield* this.lookAround(rand(1, 3));
  }
  *idleSit() {
    this.setPose('sit');
    yield* this.lookAround(rand(3, 7));
  }
  *groom() {
    this.setPose('sit');
    yield* this.wait(.4);
    for (let i = 0, n = Math.floor(rand(3, 6)); i < n; i++) {
      this.goal.groom = 1; this.face('blink', 'chew');
      yield* this.wait(rand(.5, .9));
      this.goal.groom = .6; this.face('blink', 'calm');
      yield* this.wait(.25);
    }
    // liếm lưng: vặn người sang bên
    this.goal.groom = 0; this.goal.lean = .4; this.heading += .8; this.face('blink', 'chew');
    yield* this.wait(1.2);
    this.heading -= .8; this.goal.lean = 0; this.face('open');
    yield* this.wait(.4);
  }
  *zoomies() {
    this.face('focus'); this.goal.tailUp = 1; this.tailSpeed = 5;
    for (let i = 0, n = Math.floor(rand(3, 5)); i < n; i++) {
      const p = this.world.freeSpot(this);
      yield* this.walkTo(p.x, p.z, { run: true, near: .25, maxTime: 3 });
    }
    this.tailSpeed = 1.6;
    this.setPose('sit'); this.face('open', 'chew'); // thở hổn hển, rồi giả vờ như chưa có gì xảy ra
    yield* this.wait(1);
    yield* this.groom();
  }
  *loafNap() {
    this.setPose('loaf');
    yield* this.wait(rand(1, 2));
    yield* this.sleep(rand(5, 10));
    yield* this.yawnStretch();
  }
  *lookOutWindow() {
    if (!this.claim('window')) return;
    const chair = this.world.furniture.armchair;
    const spot = this.world.windowSpot();
    if (spot) {
      yield* this.walkTo(spot.x, spot.z, { near: .1 });
    } else if (chair?.visible && !this.world.claims.has('armchair')) {
      // Ghế bành che hết sàn dưới cửa sổ: nhảy lên ghế rồi lên lưng ghế để ngắm (mèo thật hay làm vậy).
      this.world.claims.set('armchair', this);
      const local = (x, y, z) => { chair.updateMatrixWorld(true); return chair.localToWorld(new THREE.Vector3(x, y, z)); };
      const front = local(0, 0, 1.15), seat = local(0, .66, .1), back = local(0, 1.29, -.38);
      yield* this.walkTo(front.x, front.z, { ignore: 'armchair' });
      yield* this.jumpTo(seat.x, seat.y, seat.z);
      yield* this.jumpTo(back.x, back.y, back.z);
      this.surface = 'armchair';
    } else return;
    yield* this.turnTo(this.facing(WINDOW.x, -3.1));
    this.setPose('sit'); this.goal.tailUp = .2; this.tailSpeed = 2.4;
    for (let t = 0, n = rand(5, 9); t < n; t += 1.2) {
      this.lookGoal = rand(-1, 1);
      if (chance(.3)) { this.face('focus', 'chew'); yield* this.wait(.5); this.face('focus'); } // "chí chí" với chim ngoài cửa
      yield* this.wait(1.2);
    }
    this.tailSpeed = 1.6;
  }
  *rollOnRug() {
    if (!this.claim('rug')) return;
    yield* this.walkTo(rand(-.3, .3), rand(-.1, .4));
    this.setPose('loaf'); yield* this.wait(.4);
    this.setPose('roll'); this.face('happy', 'open');
    for (let t = 0, n = rand(2, 3.5); t < n; t += .5) { this.wriggle = 1; yield* this.wait(.5); }
    this.wriggle = 0;
    this.setPose('loaf'); this.face('open'); yield* this.wait(.5);
    this.setPose('sit'); yield* this.groom();
  }

  // Dùng đồ đạc: mỗi món một kiểu, như mèo thật.
  *useFurniture(id) {
    const node = this.world.furniture[id];
    if (!node?.visible || !this.claim(id)) return;
    const local = (x, y, z) => { node.updateMatrixWorld(true); return node.localToWorld(new THREE.Vector3(x, y, z)); };
    const approach = local(0, 0, (FURNITURE[id].r || .5) + .35);
    const center = local(0, 0, 0);
    yield* this.walkTo(approach.x, approach.z, { ignore: id });
    yield* this.turnTo(this.facing(center.x, center.z));

    if (id === 'catbed') {
      const spot = local(0, .14, 0);
      yield* this.jumpTo(spot.x, spot.y, spot.z); this.surface = id;
      // xoay vòng tìm chỗ nằm rồi mới cuộn tròn
      for (let i = 0; i < 2; i++) yield* this.turnTo(this.heading + Math.PI * .95, 3.5);
      this.setPose('curl');
      yield* this.sleep(rand(8, 15));
      yield* this.yawnStretch();
    } else if (id === 'armchair') {
      const seat = local(0, .66, .1);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      yield* this.turnTo(this.facing(approach.x, approach.z));
      this.setPose('knead'); this.face('blink'); this.purr = 1; // nhồi bột + rừ rừ
      yield* this.wait(rand(2.5, 4));
      this.purr = 0; this.setPose('loaf'); this.face('half');
      yield* this.sleep(rand(4, 8));
    } else if (id === 'cattree') {
      const mid = local(-.1, 1.16, -.12), top = local(.22, 1.88, .18);
      yield* this.jumpTo(mid.x, mid.y, mid.z);
      yield* this.wait(.3);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      yield* this.turnTo(Math.atan2(-this.x, -this.z));
      this.setPose('sit'); this.goal.tailUp = 0;
      yield* this.lookAround(rand(3, 6)); // vua của căn phòng
      this.setPose('loaf'); yield* this.sleep(rand(3, 6));
    } else if (id === 'shelf') {
      const top = local(0, 2, .02);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      yield* this.turnTo(Math.atan2(-this.x, -this.z));
      this.setPose('loaf'); this.goal.tailUp = 0; this.tailWag = .5;
      yield* this.lookAround(rand(4, 7));
      this.tailWag = .25;
    } else if (id === 'table') {
      const top = local(-.2, .81, -.18);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      const mug = node.userData.mug;
      if (mug && !mug.userData.knocked) {
        const mugWorld = mug.getWorldPosition(new THREE.Vector3());
        yield* this.turnTo(this.facing(mugWorld.x, mugWorld.z));
        this.setPose('sit');
        this.lookGoal = rand(-1, 1) > 0 ? 1 : -1; this.face('open'); // nhìn thẳng vào bạn...
        yield* this.wait(1.2);
        this.lookGoal = 0;
        for (let i = 0; i < 2; i++) { this.goal.paw = 1; yield* this.wait(.3); this.world.nudge(mug, this, .03); this.goal.paw = 0; yield* this.wait(.6); }
        this.goal.paw = 1; yield* this.wait(.25);
        this.world.knockOff(node, mug, this); // ...rồi đẩy rơi
        this.goal.paw = 0; this.goal.lean = .7; this.face('focus');
        yield* this.wait(1.1);
        this.goal.lean = 0; this.face('happy', 'open');
        yield* this.wait(1);
      } else {
        this.setPose('loaf'); yield* this.sleep(rand(3, 5));
      }
    } else if (id === 'yarn') {
      const toy = node.userData.toy;
      this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6;
      yield* this.wait(.8);
      this.goal.paw = 1; yield* this.wait(.25); this.goal.paw = 0;
      const landing = this.world.batToy(node, toy, this);
      yield* this.wait(.5);
      for (let i = 0; i < 2; i++) {
        // rình, lắc mông, vồ
        yield* this.walkTo(landing().x, landing().z, { near: .5, ignore: id });
        yield* this.turnTo(this.facing(landing().x, landing().z));
        this.setPose('crouch'); this.wriggle = 1; yield* this.wait(rand(.8, 1.3)); this.wriggle = 0;
        const p = landing();
        yield* this.jumpTo(p.x - Math.sin(this.heading) * .32, 0, p.z - Math.cos(this.heading) * .32);
        this.goal.paw = 1; this.world.rollToy(toy, this); yield* this.wait(.3); this.goal.paw = 0;
        yield* this.wait(.5);
      }
      this.tailSpeed = 1.6; this.face('happy');
      this.setPose('sit'); yield* this.wait(1);
      yield* this.groom();
    } else if (id === 'plant') {
      this.goal.lean = .8; this.face('focus');
      yield* this.wait(1); // ngửi
      for (let i = 0; i < 3; i++) { this.face('blink', 'chew'); this.world.wiggle(node.userData.leaves); yield* this.wait(.45); this.face('open'); yield* this.wait(.3); }
      this.goal.lean = 0; this.face('annoyed', 'zig'); // lá đắng
      yield* this.wait(.8);
    } else if (id === 'tank') {
      this.setPose('sit'); this.face('focus'); this.goal.tailUp = .1; this.tailSpeed = 4;
      const base = this.heading, fish = node.userData.fish || [];
      for (let t = 0, n = rand(6, 10); t < n; t += this.world.dt) {
        const f = fish[0]?.getWorldPosition(new THREE.Vector3());
        if (f) {
          const want = this.facing(f.x, f.z);
          this.turnToward(base + clamp(angDiff(base, want), -.5, .5), 3);
          this.lookGoal = clamp(angDiff(this.heading, want) * 3, -1, 1);
        }
        if (chance(this.world.dt * .4)) { this.goal.paw = 1; this.goal.lean = .4; }
        else if (this.goal.paw && chance(this.world.dt * 3)) { this.goal.paw = 0; this.goal.lean = 0; }
        yield;
      }
      this.goal.paw = 0; this.goal.lean = 0; this.tailSpeed = 1.6;
    } else if (id === 'lamp') {
      yield* this.turnTo(this.heading + Math.PI);
      this.setPose('loaf'); this.face('half');
      yield* this.wait(1);
      yield* this.sleep(rand(5, 8)); // sưởi ấm dưới đèn
    } else if (id === 'flowers') {
      this.goal.lean = .8; this.face('focus');
      yield* this.wait(1.2); // ngửi hoa...
      this.face('sleep', 'yawn'); this.goal.lean = .2; this.squash = .6; // ...hắt xì!
      yield* this.wait(.35);
      this.face('annoyed'); this.goal.lean = 0;
      yield* this.wait(.6);
      this.setPose('sit'); this.face('open');
      yield* this.lookAround(rand(2, 3));
    } else if (id === 'stump') {
      // cào móng: chồm lên gốc cây, hai chân trước cào xen kẽ
      this.setPose('stretch', { knead: 1, lean: .6 }); this.face('blink');
      yield* this.wait(rand(2, 3));
      const top = local(0, .46, 0);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      yield* this.turnTo(Math.atan2(-this.x, -this.z));
      this.setPose('sit'); yield* this.lookAround(rand(3, 5));
    } else if (id === 'catnip') {
      this.goal.lean = .8; this.face('focus');
      yield* this.wait(1);
      for (let i = 0; i < 3; i++) { this.face('blink', 'chew'); this.world.wiggle(node.userData.leaves); yield* this.wait(.4); }
      this.setPose('roll'); this.face('happy', 'open'); // phê cỏ mèo: lăn lộn
      for (let t = 0, n = rand(2.5, 4); t < n; t += .5) { this.wriggle = 1; yield* this.wait(.5); }
      this.wriggle = 0; this.setPose('stand');
      yield* this.zoomies();
    } else if (id === 'lantern') {
      yield* this.turnTo(this.heading + Math.PI);
      this.setPose('loaf'); this.face('half');
      yield* this.wait(1);
      yield* this.sleep(rand(4, 7));
    } else if (id === 'sandbox') {
      const spot = local(0, .18, 0);
      yield* this.jumpTo(spot.x, spot.y, spot.z); this.surface = id;
      this.setPose('crouch', { knead: 1, lean: .5 }); this.face('focus'); // đào cát
      for (let i = 0; i < 6; i++) { this.world.sand(this); yield* this.wait(.35); }
      yield* this.turnTo(this.heading + Math.PI, 3); // quay lưng lại...
      this.setPose('sit'); this.face('blink');
      yield* this.wait(1.5);
      this.setPose('crouch', { knead: 1 }); yield* this.wait(1); // ...rồi lấp lại cho kín
      this.setPose('stand'); this.face('open');
    } else if (id === 'cathouse') {
      if (chance(.55)) { // chui vào nhà, chỉ ló mặt ra cửa rồi ngủ
        const inside = local(0, 0, .15);
        yield* this.walkTo(inside.x, inside.z, { ignore: id, near: .05 });
        yield* this.turnTo(this.facing(approach.x, approach.z));
        this.setPose('loaf'); this.face('half');
        yield* this.sleep(rand(6, 10));
        yield* this.walkTo(approach.x, approach.z, { ignore: id });
      } else { // leo lên mái ngồi canh vườn
        const roof = local(0, 1.2, 0);
        yield* this.jumpTo(roof.x, roof.y, roof.z); this.surface = id;
        yield* this.turnTo(Math.atan2(-this.x, -this.z));
        this.setPose('loaf'); yield* this.lookAround(rand(4, 7));
      }
    } else if (id === 'pond') {
      this.setPose('crouch'); this.face('focus'); this.tailSpeed = 5; this.goal.tailUp = .1;
      const fish = node.userData.fish || [];
      for (let t = 0, n = rand(4, 7); t < n; t += this.world.dt) {
        const f = fish[0]?.getWorldPosition(new THREE.Vector3());
        if (f) this.lookGoal = clamp(angDiff(this.heading, this.facing(f.x, f.z)) * 3, -1, 1);
        yield;
      }
      this.goal.paw = 1; this.goal.lean = .6; yield* this.wait(.3); // khều nước
      this.world.splash(node, this);
      this.goal.paw = 0; this.goal.lean = 0; this.face('annoyed', 'zig');
      this.setPose('sit');
      for (let i = 0; i < 4; i++) { this.goal.paw = i % 2; yield* this.wait(.12); } // vẩy chân cho khô
      this.goal.paw = 0; this.tailSpeed = 1.6;
      yield* this.groom();
    } else if (id === 'hammock') {
      const sling = local(0, .42, 0);
      yield* this.jumpTo(sling.x, sling.y, sling.z); this.surface = id;
      yield* this.turnTo(this.heading + Math.PI * .9, 3);
      this.setPose('curl');
      yield* this.sleep(rand(8, 14));
      yield* this.yawnStretch();
    } else if (id === 'birdbath') {
      const bird = node.userData.bird;
      if (bird && !bird.userData.away) {
        this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6; this.wriggle = 1;
        yield* this.wait(rand(1, 1.6));
        this.wriggle = 0;
        this.world.scareBird(node); // chim bay mất
        this.setPose('sit'); this.lookGoal = .6;
        for (let i = 0; i < 3; i++) { this.face('focus', 'chew'); yield* this.wait(.25); this.face('focus'); yield* this.wait(.2); } // "chí chí" tiếc nuối
        this.face('annoyed', 'zig'); yield* this.wait(1); this.tailSpeed = 1.6;
      } else {
        const bowl = local(0, .92, .05);
        yield* this.jumpTo(bowl.x, bowl.y, bowl.z); this.surface = id;
        this.goal.lean = .8; this.face('blink', 'chew'); yield* this.wait(2); // uống nước
        this.goal.lean = 0; this.face('open');
      }
    } else if (id === 'bench') {
      const seat = local(0, .5, 0);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      yield* this.turnTo(this.heading + Math.PI, 3);
      this.setPose('loaf'); this.face('half');
      yield* this.sleep(rand(5, 9));
    }
  }

  // Vườn: rình và vồ bướm.
  *chaseButterfly() {
    const fly = this.world.butterflies?.[Math.floor(Math.random() * 2)];
    if (!fly) return;
    this.face('focus'); this.tailSpeed = 5; this.goal.tailUp = .3;
    for (let i = 0; i < 3; i++) {
      // Điểm tới / điểm vồ luôn dời ra khỏi đồ đạc: không bao giờ nhắm vào chỗ không tới được (trước đây gây đứng hình).
      const p = this.world.reachable(fly.position.x, fly.position.z);
      yield* this.walkTo(p.x, p.z, { near: .55, maxTime: 2.5 });
      yield* this.turnTo(this.facing(fly.position.x, fly.position.z), 8);
      this.setPose('crouch'); this.wriggle = 1; yield* this.wait(rand(.5, .9)); this.wriggle = 0;
      const q = this.world.reachable(fly.position.x - Math.sin(this.heading) * .2, fly.position.z - Math.cos(this.heading) * .2);
      yield* this.jumpTo(q.x, 0, q.z);
      this.goal.paw = 1; fly.scare(); yield* this.wait(.3); this.goal.paw = 0;
    }
    this.tailSpeed = 1.6; this.setPose('sit'); this.face('happy', 'chew');
    yield* this.wait(1);
  }

  // ----- Tương tác giữa hai con -----
  *boop(other) {
    this.social = other.social = 'boop'; this.partner = other; other.partner = this;
    other.interrupt(other.beBooped(this));
    const spot = { x: other.x + Math.sin(other.heading) * .7, z: other.z + Math.cos(other.heading) * .7 };
    this.goal.tailUp = 1;
    yield* this.walkTo(spot.x, spot.z, { near: .12, maxTime: 6 });
    yield* this.turnTo(this.facing(other.x, other.z));
    this.goal.lean = 1; other.goal.lean = 1;
    this.face('happy'); other.face('happy');
    yield* this.wait(.5);
    this.world.hearts(this, other);
    yield* this.wait(.8);
    this.goal.lean = 0; other.goal.lean = 0;
    other.done = true;
    this.setPose('sit'); yield* this.slowBlink();
  }
  *beBooped(from) {
    this.social = 'boop'; this.partner = from; this.done = false;
    try {
      this.setPose('sit');
      for (let t = 0; !this.done && t < 8; t += this.world.dt) { this.turnToward(this.facing(from.x, from.z), 4); yield; }
      yield* this.wait(.6);
    } finally { this.social = null; this.partner = null; this.done = false; }
    yield* this.life();
  }
  *chase(other) {
    this.social = other.social = 'chase'; this.partner = other; other.partner = this;
    other.interrupt(other.flee(this));
    this.face('focus'); this.goal.tailUp = 1; this.tailSpeed = 5;
    for (let t = 0; t < 4.5 && other.social === 'chase';) {
      const start = performance.now();
      yield* this.walkTo(other.x, other.z, { run: true, near: .6, maxTime: .5 });
      t += (performance.now() - start) / 1000 + this.world.dt;
    }
    other.done = true;
    this.tailSpeed = 1.6; this.setPose('sit'); this.face('happy', 'chew');
    yield* this.wait(1.2);
    yield* this.groom();
  }
  *flee(from) {
    this.social = 'chase'; this.partner = from; this.done = false;
    try {
      this.face('annoyed'); this.goal.tailUp = 1; this.tailSpeed = 5;
      for (const until = this.world.time + 7; !this.done && this.world.time < until;) {
        let dx = this.x - from.x, dz = this.z - from.z;
        const d = Math.hypot(dx, dz) || 1;
        dx /= d; dz /= d;
        let tx = this.x + dx * 1.4 + rand(-.6, .6), tz = this.z + dz * 1.4 + rand(-.6, .6);
        if (Math.abs(tx) > ROOM - .2 || Math.abs(tz) > ROOM - .2) { tx = -this.x * .6 + rand(-.8, .8); tz = -this.z * .6 + rand(-.8, .8); } // bị dồn vào góc thì vòng ra
        yield* this.walkTo(tx, tz, { run: true, near: .3, maxTime: .7 });
      }
      this.tailSpeed = 1.6; this.setPose('sit'); this.face('annoyed', 'zig');
      yield* this.wait(1);
    } finally { this.social = null; this.partner = null; this.done = false; }
    yield* this.groom();
    yield* this.life();
  }
  *groomBuddy(other) {
    this.social = other.social = 'groom'; this.partner = other; other.partner = this;
    other.interrupt(other.beGroomed(this));
    const side = other.heading + Math.PI / 2;
    yield* this.walkTo(other.x + Math.sin(side) * .6, other.z + Math.cos(side) * .6, { near: .12, maxTime: 6 });
    yield* this.turnTo(this.facing(other.x, other.z));
    this.setPose('loaf', { lean: .6 });
    for (let i = 0; i < 5; i++) { this.face('blink', 'chew'); yield* this.wait(.5); this.face('blink'); yield* this.wait(.3); }
    this.world.hearts(this, other);
    other.done = true;
    yield* this.sleep(rand(3, 5));
  }
  *beGroomed(from) {
    this.social = 'groom'; this.partner = from; this.done = false;
    try {
      this.setPose('loaf'); this.face('happy'); this.purr = 1;
      for (let t = 0; !this.done && t < 9; t += this.world.dt) yield;
      this.purr = 0;
    } finally { this.social = null; this.partner = null; this.done = false; this.purr = 0; }
    yield* this.sleep(rand(3, 6));
    yield* this.life();
  }
  *nap() { // AFK: ai đang ở đâu thì ngủ luôn ở đó
    this.release(); this.speed = 0;
    this.setPose(this.y > .01 ? 'loaf' : 'curl');
    this.face('half'); yield* this.wait(rand(.3, 1.2));
    this.face('sleep'); this.sleeping = true; this.tailWag = .05; this.tailSpeed = .5;
    try { while (this.world.afk) yield; } finally { this.sleeping = false; this.tailWag = .25; this.tailSpeed = 1.6; }
    yield* this.wait(rand(0, .8));
    yield* this.yawnStretch();
    yield* this.life();
  }
  // Bị người chơi nhấc lên: lơ lửng theo ngón tay, thân lắc như con lắc; thả tay thì rơi xuống chỗ trống gần nhất,
  // nhún khi chạm đất, vẩy người rồi liếm lông (mèo thật hay làm vậy sau khi bị bế).
  *beCarried() {
    this.release(); this.surface = null; this.sleeping = false; this.speed = 0; this.social = null; this.partner = null;
    this.face('annoyed'); this.setPose('stand', { tailUp: 0 }); this.tailWag = .6; this.tailSpeed = 4;
    const lifted = this.world.time;
    while (this.carried) {
      const dt = this.world.dt;
      spring(this, 'x', this.carryX, 140, .8, dt);
      spring(this, 'z', this.carryZ, 140, .8, dt);
      spring(this, 'y', CARRY_H, 90, .7, dt);
      if (this.world.time - lifted > 1.4 && this.eyes === 'annoyed') this.face('half'); // bế lâu thì lim dim chịu trận
      yield;
    }
    this.tailWag = .25; this.tailSpeed = 1.6;
    const land = this.world.landingSpot(this), x0 = this.x, z0 = this.z, y0 = Math.max(this.y, .01);
    let vy = 0;
    while (this.y > 0) {
      vy -= 14 * this.world.dt;
      this.y = Math.max(0, this.y + vy * this.world.dt);
      const k = 1 - this.y / y0;
      this.x = x0 + (land.x - x0) * k; this.z = z0 + (land.z - z0) * k;
      yield;
    }
    this.xV = this.zV = this.yV = 0;
    this.squash = .9; this.squashV = 0; this.earFlopV = (this.earFlopV || 0) + 16;
    this.face('annoyed');
    yield* this.wait(.35);
    this.wriggle = 1; yield* this.wait(.45); this.wriggle = 0; // vẩy người
    this.face('open');
    this.setPose('sit');
    yield* this.groom();
    yield* this.life();
  }
  pet() {
    this.petUntil = this.world.time + 1.3;
    if (this.sleeping) return; // ngủ say: chỉ mỉm cười, không dậy
  }

  // ----- Mỗi frame: não chạy trước, rồi thân thể đi theo bằng lò xo -----
  update(dt, t) {
    const petting = t < this.petUntil;
    if (!petting) this.brain?.next();
    const pose = this.pose, goal = this.goal, rig = this.rig;
    for (const key in goal) { const [k, z] = POSE_SPRING[key] || [80, .8]; spring(pose, key, goal[key], k, z, dt); }
    spring(this, 'look', this.lookGoal, 90, .8, dt);
    spring(this, 'squash', 0, 170, .32, dt);           // nhún/giãn: tắt ít nên nảy 1–2 nhịp
    spring(this, 'earFlop', 0, 120, .35, dt);
    spring(this, 'yaw', this.yaw + angDiff(this.yaw, this.heading), 150, .85, dt);
    const turnRate = this.yawV || 0;
    // Con lắc khi bị nhấc: vận tốc kéo (theo hướng thân) làm thân nghiêng ngược lại rồi đung đưa tắt dần.
    const vx = this.xV || 0, vz = this.zV || 0, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const forward = this.carried ? vx * sy + vz * cy : 0, lateral = this.carried ? vx * cy - vz * sy : 0;
    spring(this, 'swayF', clamp(-forward * .16, -.5, .5), 45, .28, dt);
    spring(this, 'swayL', clamp(lateral * .16, -.5, .5), 45, .28, dt);
    const moveGoal = clamp(this.speed / .72, 0, 2.4) + (this.shuffle || 0) * .5;
    this.shuffle = 0;
    spring(this, 'move', moveGoal, 60, .95, dt);
    const accel = (this.speed - (this.lastSpeed || 0)) / Math.max(dt, 1e-3);
    this.lastSpeed = this.speed;
    this.lean = damp(this.lean, clamp(accel * .045, -.14, .14), 7, dt);
    const vy = (this.y - this.lastY) / Math.max(dt, 1e-3);
    this.lastY = this.y;

    // Cưng: 2 cú nảy parabol, mỗi lần chạm đất nhún một cái
    let hop = 0;
    if (petting && !this.sleeping) {
      const e = 1.3 - (this.petUntil - t), seg = e % .5, k = seg / .42;
      hop = e < 1 && k < 1 ? .2 * 4 * k * (1 - k) : 0;
      if (this.hopY > 0 && hop === 0) { this.squash = .55; this.squashV = 0; this.earFlopV = (this.earFlopV || 0) + 8; }
    }
    this.hopY = hop;

    // ---- Mặt: mí mắt khép dần rồi mới nhắm; tự chớp; mắt liếc ----
    let eyes = this.eyes, mouth = this.mouth;
    if (petting) { eyes = this.sleeping ? 'sleep' : 'happy'; mouth = this.sleeping ? 'calm' : 'open'; }
    this.nextBlink -= dt;
    const canBlink = eyes === 'open' || eyes === 'focus';
    const blinking = canBlink && this.nextBlink < 0;
    if (this.nextBlink < -.16) this.nextBlink = chance(.2) ? rand(.15, .3) : rand(2.5, 6); // thỉnh thoảng chớp đôi
    spring(this, 'lid', blinking ? 0 : 1, 900, 1, dt);
    if (canBlink && this.lid < .45) eyes = 'blink';
    const faceTex = faceTexture(this.breed, mouth), eyesTex = eyesTexture(this.breed, eyes);
    if (rig.faceMat.map !== faceTex) { rig.faceMat.map = faceTex; rig.faceMat.needsUpdate = true; }
    if (rig.eyesMat.map !== eyesTex) { rig.eyesMat.map = eyesTex; rig.eyesMat.needsUpdate = true; }
    rig.eyes.position.x = this.look * .035;
    rig.eyes.scale.y = eyes === 'blink' || !canBlink ? 1 : clamp(this.lid, .2, 1);

    // ---- Tai: giật bằng xung lò xo, cụp khi tiếp đất, dỏng khi tập trung, cụp khi bực ----
    this.nextEar -= dt;
    if (this.nextEar < 0) { this.earSide = chance(.5) ? 0 : 1; this.earTwitchV = (this.earTwitchV || 0) + 22; this.nextEar = rand(2, 7); }
    spring(this, 'earTwitch', 0, 380, .28, dt);
    const annoyed = this.eyes === 'annoyed', focus = this.eyes === 'focus';
    rig.ears.forEach((ear, i) => {
      const side = i ? 1 : -1;
      ear.rotation.z = -side * .18 + (i === this.earSide ? this.earTwitch * .045 * side : 0) + (annoyed ? side * .5 : 0);
      ear.rotation.x = -this.earFlop * .05 + (focus ? .18 : 0) - (this.sleeping ? .15 : 0);
    });

    // ---- Thân ----
    const move = Math.max(0, this.move), amp = Math.min(1.2, move), run = this.running;
    const g = this.gait;
    const walkBob = run ? (1 - Math.cos(g)) / 2 * .075 * amp : (1 - Math.cos(2 * g)) / 2 * .022 * amp;
    const sway = run ? 0 : Math.sin(g) * .035 * amp;
    const gaitPitch = run ? Math.sin(g) * .11 * amp : Math.sin(2 * g) * .014 * amp;
    const idle = move < .1 && !this.sleeping ? Math.sin(t * .7 + this.phase) * .018 : 0; // dồn trọng tâm khi đứng/ngồi yên
    const breathe = Math.sin(t * (this.sleeping ? 1.6 : 2.6) + this.phase) * (this.sleeping ? .03 : .011);
    const purr = (this.purr || (petting ? 1 : 0)) ? Math.sin(t * 90) * .004 : 0;

    rig.root.position.set(this.x, this.y, this.z);
    rig.root.rotation.y = this.yaw;
    rig.hopper.position.y = hop + walkBob + purr;
    const s = this.squash; // dương = nhún bẹp, âm = vươn dài
    rig.hopper.scale.set(1 + s * .12 - breathe * .3, 1 - s * .2 + breathe, 1 + s * .08 - s * (s < 0 ? .15 : 0));
    const turnLean = clamp(-turnRate * .045 * (.35 + amp), -.2, .2);
    rig.roller.rotation.z = this.swayL + pose.roll * 1.3 + (this.wriggle ? Math.sin(t * 20) * .09 : 0) + pose.curl * .12 + sway + turnLean + idle;
    rig.roller.position.y = pose.roll * .2;
    // Ngồi kiểu mèo thật: mông hạ sát sàn, ngực nhổm nhẹ -> chân trước gần như giữ độ dài, trông tròn trịa.
    rig.pivot.position.y = LEG * (1 - Math.max(clamp(pose.lie, 0, 1), clamp(pose.sit, 0, 1) * .9)) + pose.stretch * .1 - pose.lie * .02;
    rig.pivot.rotation.x = -clamp(pose.sit, 0, 1) * .24 + pose.stretch * .32 + pose.lean * .22 + (this.airPitch || 0) - pose.groom * .15 + gaitPitch + this.lean + this.swayF;
    rig.pivot.position.z = -D / 2 + pose.lean * .1;
    rig.pivot.rotation.y = 0;
    rig.roller.rotation.y = pose.curl * .35 + this.look * .12; // xoay cả thân lẫn chân theo hướng nhìn
    rig.body.scale.y = 1 - pose.lie * .1;

    // ---- Chân: đi = chéo cặp, chạy = phi nước đại; nhấc bàn chân khi đưa về trước; trên không duỗi/đón ----
    const air = this.airK;
    const sit = clamp(pose.sit, 0, 1);
    const pitch = rig.pivot.rotation.x, pivotY = rig.pivot.position.y, pivotZ = rig.pivot.position.z;
    const bodyLift = H / 2 * (1 - rig.body.scale.y); // thân co lại khi nằm: đáy thân nhích lên
    const groundY = -rig.roller.position.y;          // mặt sàn trong hệ toạ độ roller
    rig.legs.forEach((leg, i) => {
      const diagonal = i === 0 || i === 3 ? 0 : Math.PI;
      const phase = run ? (leg.front ? 0 : Math.PI * .75) + (i % 2) * .25 : diagonal;
      const cyc = g + phase;
      let swing = Math.sin(cyc) * (run ? .85 : .55) * amp;
      let lift = Math.max(0, Math.cos(cyc)) * (run ? .05 : .035) * amp;
      if (air !== null) { // bật lên: chân sau đạp duỗi ra sau; gần đất: chân trước vươn đón
        swing = leg.front ? -.95 * air + .3 * (1 - air) : .85 * (1 - air) - .2 * air;
        lift = 0;
      }
      if (this.carried) { swing = this.swayF * 1.6 + Math.sin(t * 3 + i) * .08; lift = 0; } // chân thõng đung đưa
      if (leg.front && i === 1) { swing -= pose.paw * 1.6 + pose.groom * 1.9; lift += pose.paw * .12 + pose.groom * .18; }
      if (leg.front && pose.knead > .1) { const press = Math.max(0, Math.sin(t * 5 + i * Math.PI)); swing -= press * .6 * pose.knead; lift += press * .03 * pose.knead; }
      leg.hip.rotation.x = swing;
      // Khớp chân luôn gắn đúng đáy thân: tính điểm đáy thân nằm ngay trên chân từ TỔNG độ chúi của thân
      // (ngồi, vươn, cúi, chúi khi bay, lắc khi bị nhấc...), nên tư thế nào chân cũng không hở khỏi thân.
      // Chân và thân cùng nằm trong roller nên cùng hệ toạ độ; thân quay quanh pivot (mép sau-dưới).
      const hipZ = (leg.front ? 1 : -1) * D * .3 + (leg.front ? pose.stretch * .1 + pose.lean * .08 : 0);
      const cosP = Math.cos(pitch), along = clamp((hipZ - pivotZ) / (Math.abs(cosP) > .2 ? cosP : .2), 0, D);
      const bottomY = pivotY - Math.sin(pitch) * along + bodyLift;
      leg.hip.position.set(leg.hip.position.x, bottomY + .03 + lift, hipZ);
      // Độ dài chân: chỉ kéo ống chân, bàn chân giữ nguyên cỡ và luôn nằm ở đáy (không kéo méo góc bo).
      //   bị nhấc -> thõng dài; đang bay -> dài bình thường; trên sàn -> vừa đúng chạm đất (trừ phần co chân khi nằm/ngồi).
      const full = LEG + .03;
      const lie = clamp(pose.lie, 0, 1);
      const tuck = leg.front ? lie * (1 - clamp(pose.roll, 0, 1) * .5) : Math.max(lie, sit * .9);
      const reach = (bottomY + .03 - groundY) / full; // độ dài để bàn chân vừa chạm sàn (không tính phần nhấc chân)
      const len = this.carried ? 1.3 : air !== null ? 1 : clamp(reach * (1 - tuck * .85), .15, 2.2);
      leg.leg.scale.y = len; leg.leg.position.y = -full * len / 2;
      leg.foot.position.y = -full * len + .025;
      leg.hip.scale.y = 1;
    });

    // ---- Đuôi: mỗi đốt một lò xo, càng về chóp càng mềm; văng ngược khi quay người và khi nhảy ----
    const wagSpeed = this.tailSpeed * (petting ? 2 : 1);
    const stream = clamp(vy * .22, -.7, .7);
    rig.tail.forEach((joint, i) => {
      const wave = Math.sin(t * wagSpeed - i * .75) * this.tailWag * (1 + i * .25);
      const inertia = -turnRate * .1 * (1 + i * .35) - (run ? Math.sin(g) * .08 : 0);
      const zGoal = (i === 0 ? wave + pose.curl * 1.2 : wave * .6 + pose.curl * .55) + inertia;
      const xGoal = i === 0
        ? (this.carried ? -2.95 + this.swayF * .8 : -(2.45 - pose.tailUp * 1.9) * (1 - pose.curl) - pose.curl * 1.5 + stream)
        : (pose.tailUp > .7 ? -.18 : .12) * (1 - pose.curl) + (i === 4 && pose.tailUp > .7 ? .5 : 0) + stream * .25;
      const k = 160 / (1 + i * .55), zeta = .42 + i * .04;
      const zs = { v: this.tailZ[i], vV: this.tailZV?.[i] || 0 }, xs = { v: this.tailX[i], vV: this.tailXV?.[i] || 0 };
      spring(zs, 'v', zGoal, k, zeta, dt); spring(xs, 'v', xGoal, k, zeta + .1, dt);
      (this.tailZV ||= [])[i] = zs.vV; (this.tailXV ||= [])[i] = xs.vV;
      this.tailZ[i] = zs.v; this.tailX[i] = xs.v;
      joint.rotation.z = zs.v; joint.rotation.x = xs.v;
    });

    // Zzz
    rig.z.visible = this.sleeping;
    if (this.sleeping) {
      const k = (t * .45 + this.phase) % 1;
      rig.z.position.set(.25 + k * .15 + Math.sin(k * 6) * .03, H + .25 + k * .45, D * .6);
      rig.z.material.opacity = Math.sin(k * Math.PI);
      rig.z.scale.set(.2 + k * .12, .18 + k * .11, 1);
    }
  }
}

// ---------- Cả đàn: chọn hành vi, vật cản, đồ chơi rơi/lăn ----------
export function createCatLife(ctx) {
  const { scene, furniture, heartsAt } = ctx; // ctx.zone đọc lúc chạy (đổi khu không cần tạo lại đàn mèo)
  const tweens = [];
  const world = {
    scene, furniture, butterflies: ctx.butterflies, cats: [], claims: new Map(), dt: 0, time: 0, afk: false,
    sand(cat) { // hạt cát văng ra sau lưng mèo
      const grain = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), new THREE.MeshStandardMaterial({ color: '#f3dfb0' }));
      const x0 = cat.x, z0 = cat.z, back = cat.heading + Math.PI + rand(-.6, .6);
      scene.add(grain);
      world.tween(.45, k => grain.position.set(x0 + Math.sin(back) * k * .5, cat.y + .1 + Math.sin(k * Math.PI) * .3, z0 + Math.cos(back) * k * .5), () => scene.remove(grain));
    },
    splash(pond, cat) { // vòng sóng lan ra trên mặt ao
      const ring = new THREE.Mesh(new THREE.RingGeometry(.05, .08, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cat.x + Math.sin(cat.heading) * .45, .06, cat.z + Math.cos(cat.heading) * .45);
      scene.add(ring);
      world.tween(.9, k => { ring.scale.setScalar(1 + k * 5); ring.material.opacity = 1 - k; }, () => scene.remove(ring));
    },
    scareBird(bath) {
      const bird = bath.userData.bird;
      if (!bird || bird.userData.away) return;
      bird.userData.away = true;
      const from = bird.position.clone();
      world.tween(1.4, k => { bird.position.set(from.x + k * 2.5, from.y + k * 3, from.z - k * 1.5); bird.rotation.z = Math.sin(k * 40) * .3; },
        () => { bird.visible = false; bird.userData.returnAt = world.time + 12; });
    },
    obstacles(ignore) {
      return Object.entries(furniture).filter(([id, node]) => node.visible && id !== ignore && FURNITURE[id]?.r)
        .map(([id, node]) => ({ x: node.position.x, z: node.position.z, r: FURNITURE[id].r }));
    },
    // Chỗ trống trên sàn ngay dưới cửa sổ (cửa sổ rộng x -2.2..-1.0); null nếu đồ đạc che hết.
    windowSpot() {
      for (const x of [WINDOW.x, WINDOW.x + .3, WINDOW.x - .3, WINDOW.x + .55, WINDOW.x - .5]) {
        if (!world.obstacles().some(ob => Math.hypot(x - ob.x, WINDOW.z - ob.z) < ob.r + .42)) return { x, z: WINDOW.z };
      }
      return null;
    },
    // Chỗ đáp khi thả mèo: đúng điểm thả, trừ khi trùng đồ đạc thì dời ra mép đồ gần nhất.
    landingSpot(cat) { return world.reachable(cat.x, cat.z); },
    // Điểm gần (x, z) nhất mà mèo đứng được: trong phòng và ngoài mọi vật cản.
    reachable(px, pz) {
      let x = clamp(px, -ROOM, ROOM), z = clamp(pz, -ROOM, ROOM);
      for (const ob of world.obstacles()) {
        const dx = x - ob.x, dz = z - ob.z, d = Math.hypot(dx, dz) || 1e-4, reach = ob.r + W * .45;
        if (d < reach) { x = clamp(ob.x + dx / d * reach, -ROOM, ROOM); z = clamp(ob.z + dz / d * reach, -ROOM, ROOM); }
      }
      return { x, z };
    },
    center(id) { const node = furniture[id]; return { x: node.position.x, z: node.position.z, r: FURNITURE[id]?.r || .5 }; },
    freeSpot(cat) {
      for (let i = 0; i < 30; i++) {
        const x = rand(-ROOM + .3, ROOM - .3), z = rand(-ROOM + .3, ROOM - .3);
        if (Math.hypot(x - cat.x, z - cat.z) < .8) continue;
        if (world.obstacles().some(ob => Math.hypot(x - ob.x, z - ob.z) < ob.r + .4)) continue;
        if (world.cats.some(other => other !== cat && Math.hypot(x - other.x, z - other.z) < .7)) continue;
        return { x, z };
      }
      return { x: rand(-1, 1), z: rand(-1, 1) };
    },
    choose(cat, last) {
      const options = [];
      const add = (name, weight, make) => { if (weight > 0 && name !== last) options.push([name, weight, make]); };
      add('wander', 3, () => cat.wander());
      add('sit', 1.4, () => cat.idleSit());
      add('groom', 1.2, () => cat.groom());
      add('stretch', .5, () => cat.yawnStretch());
      add('zoomies', .35, () => cat.zoomies());
      add('nap', .7, () => cat.loafNap());
      const garden = ctx.zone === 'garden';
      if (!garden && !world.claims.has('window')) add('window', .8, () => cat.lookOutWindow());
      if (garden) add('butterfly', 1.1, () => cat.chaseButterfly());
      if (furniture.rug?.visible && !world.claims.has('rug')) add('rug', .6, () => cat.rollOnRug());
      const weights = garden
        ? { flowers: .9, stump: 1.1, catnip: 1.2, lantern: .7, sandbox: 1, cathouse: 1.5, pond: 1.3, hammock: 1.4, birdbath: 1.1, bench: .9 }
        : { catbed: 1.6, armchair: 1.3, cattree: 1.4, shelf: .9, table: 1.1, yarn: 1.3, plant: .8, tank: 1.4, lamp: .9 };
      for (const [id, weight] of Object.entries(weights)) {
        if (furniture[id]?.visible && !world.claims.has(id)) add(id, weight, () => cat.useFurniture(id));
      }
      const buddies = world.cats.filter(other => other !== cat && other.interruptible() && other.y < .01);
      if (buddies.length) {
        const other = buddies[Math.floor(Math.random() * buddies.length)];
        add('boop', 1, () => cat.boop(other));
        add('chase', .6, () => cat.chase(other));
        add('groomBuddy', .5, () => cat.groomBuddy(other));
      }
      let roll = Math.random() * options.reduce((sum, [, w]) => sum + w, 0);
      for (const [name, weight, make] of options) { roll -= weight; if (roll <= 0) return [name, make()]; }
      return ['wander', cat.wander()];
    },
    tween(duration, fn, done) { tweens.push({ t: 0, duration, fn, done }); },
    hearts(a, b) {
      const p = new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + H + .15, (a.z + b.z) / 2);
      heartsAt(p);
    },
    wiggle(leaves) {
      if (!leaves) return;
      world.tween(.4, k => { leaves.rotation.z = Math.sin(k * Math.PI * 4) * .08 * (1 - k); leaves.scale.setScalar(1 + Math.sin(k * Math.PI) * .05); });
    },
    nudge(mug, cat, amount) {
      const from = mug.position.clone(), dir = world.pushDir(mug, cat);
      world.tween(.18, k => { mug.position.x = from.x + dir.x * amount * k; mug.position.z = from.z + dir.z * amount * k; });
    },
    pushDir(mug, cat) { // hướng đẩy trong không gian của cái bàn
      const table = mug.parent;
      const catLocal = table.worldToLocal(new THREE.Vector3(cat.x, mug.getWorldPosition(new THREE.Vector3()).y, cat.z));
      const dir = new THREE.Vector3(mug.position.x - catLocal.x, 0, mug.position.z - catLocal.z);
      return dir.lengthSq() < 1e-4 ? new THREE.Vector3(1, 0, 0) : dir.normalize();
    },
    knockOff(table, mug, cat) {
      const dir = world.pushDir(mug, cat), from = mug.position.clone();
      const to = new THREE.Vector3(from.x + dir.x * .75, .1, from.z + dir.z * .75);
      mug.userData.knocked = true;
      world.tween(.65, k => {
        const e = k * k;
        mug.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * e + Math.sin(k * Math.PI) * .12, from.z + (to.z - from.z) * k);
        mug.rotation.set(dir.z * k * Math.PI / 2, 0, -dir.x * k * Math.PI / 2);
      }, () => {
        world.tween(.25, k => { mug.position.y = .1 + Math.sin(k * Math.PI) * .06; }); // nảy "cạch"
        mug.userData.restoreAt = world.time + 9;
      });
    },
    batToy(basket, toy) {
      const from = toy.position.clone(), to = new THREE.Vector3(rand(-.3, .3), .19, 1.3);
      toy.userData.out = true;
      world.tween(.7, k => {
        toy.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * .35, from.z + (to.z - from.z) * k);
        toy.rotation.x += .25;
      });
      return () => { basket.updateMatrixWorld(true); return toy.getWorldPosition(new THREE.Vector3()); };
    },
    rollToy(toy, cat) {
      const basket = toy.parent, from = toy.position.clone();
      const dirWorld = new THREE.Vector3(Math.sin(cat.heading), 0, Math.cos(cat.heading)).multiplyScalar(rand(.5, .9));
      const world0 = toy.getWorldPosition(new THREE.Vector3());
      const target = world0.clone().add(dirWorld);
      target.x = clamp(target.x, -ROOM, ROOM); target.z = clamp(target.z, -ROOM, ROOM); target.y = .19;
      const to = basket.worldToLocal(target.clone());
      to.y = .19;
      world.tween(.6, k => {
        const e = 1 - (1 - k) ** 2;
        toy.position.set(from.x + (to.x - from.x) * e, .19 + Math.abs(Math.sin(k * Math.PI * 2)) * .08 * (1 - k), from.z + (to.z - from.z) * e);
        toy.rotation.x += .3;
      });
      toy.userData.restoreAt = world.time + 6;
    },
  };

  // Không cho mèo lồng vào nhau hay xuyên đồ đạc: sau khi di chuyển, đẩy tách mọi cặp đang chồng lên nhau.
  // Chỉ áp cho mèo đứng trên sàn (đang nhảy hoặc đang ngồi trên đồ thì bỏ qua), và bỏ qua món mèo đang dùng.
  const CAT_GAP = W + .04;
  const grounded = cat => cat.y < .01 && !cat.airPitch;
  function pushOutOfFurniture(cat) {
    for (const ob of world.obstacles(cat.busyWith)) {
      const dx = cat.x - ob.x, dz = cat.z - ob.z, d = Math.hypot(dx, dz) || 1e-4, reach = ob.r + W * .45;
      if (d < reach) { cat.x = clamp(ob.x + dx / d * reach, -ROOM, ROOM); cat.z = clamp(ob.z + dz / d * reach, -ROOM, ROOM); }
    }
  }
  function separate() {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < world.cats.length; i++) {
        const a = world.cats[i];
        if (!grounded(a)) continue;
        for (let j = i + 1; j < world.cats.length; j++) {
          const b = world.cats[j];
          if (!grounded(b)) continue;
          const d = Math.hypot(b.x - a.x, b.z - a.z);
          if (d >= CAT_GAP) continue;
          // hướng tách (vector đơn vị); trùng hẳn chỗ thì tách theo hướng nhìn của con thứ hai
          const ux = d > 1e-4 ? (b.x - a.x) / d : Math.sin(b.heading), uz = d > 1e-4 ? (b.z - a.z) / d : Math.cos(b.heading);
          const half = (CAT_GAP - d) / 2;
          a.x = clamp(a.x - ux * half, -ROOM, ROOM); a.z = clamp(a.z - uz * half, -ROOM, ROOM);
          b.x = clamp(b.x + ux * half, -ROOM, ROOM); b.z = clamp(b.z + uz * half, -ROOM, ROOM);
        }
        pushOutOfFurniture(a);
      }
    }
    // Lượt cuối chỉ đẩy khỏi đồ đạc: đồ đứng yên nên luôn thắng, mèo không lấn vào đồ.
    world.cats.filter(grounded).forEach(pushOutOfFurniture);
  }
  function restoreBird() {
    const bird = furniture.birdbath?.userData.bird;
    if (!bird?.userData.returnAt || world.time < bird.userData.returnAt) return;
    bird.userData.returnAt = 0; bird.userData.away = false; bird.visible = true;
    bird.position.copy(bird.userData.home); bird.rotation.z = 0;
    world.tween(.4, k => bird.scale.setScalar(Math.max(.01, k)));
  }
  function restoreToys() {
    for (const id of ['table', 'yarn']) {
      const node = furniture[id];
      const item = node?.userData.mug || node?.userData.toy;
      if (!item?.userData.restoreAt || world.time < item.userData.restoreAt || world.claims.has(id)) continue;
      item.userData.restoreAt = 0; item.userData.knocked = false; item.userData.out = false;
      item.position.copy(item.userData.home); item.rotation.set(0, 0, 0);
      world.tween(.35, k => item.scale.setScalar(Math.max(.01, k + Math.sin(k * Math.PI) * .2)));
    }
  }

  return {
    carryHeight: CARRY_H,
    pickUp(cat, x, z) {
      cat.carried = true; cat.petUntil = 0;
      cat.carryX = clamp(x, -ROOM, ROOM); cat.carryZ = clamp(z, -ROOM, ROOM);
      cat.interrupt(cat.beCarried());
    },
    carryTo(cat, x, z) { cat.carryX = clamp(x, -ROOM, ROOM); cat.carryZ = clamp(z, -ROOM, ROOM); },
    drop(cat) { cat.carried = false; },
    setCats(breeds) {
      const keep = [];
      breeds.forEach(breed => {
        const existing = world.cats.find(cat => cat.breed === breed && !keep.includes(cat));
        if (existing) keep.push(existing);
        else {
          const spot = world.freeSpot({ x: 99, z: 99 });
          keep.push(new Cat(world, breed, spot.x, spot.z));
        }
      });
      world.cats.filter(cat => !keep.includes(cat)).forEach(cat => { cat.release(); cat.dispose(); });
      world.cats = keep;
    },
    // Món đồ bị gỡ khi mèo đang ngồi trên / đang dùng: mèo rơi xuống sàn rồi làm việc khác.
    furnitureChanged() {
      world.cats.forEach(cat => {
        if (cat.carried) return;
        const using = cat.busyWith && furniture[cat.busyWith] && !furniture[cat.busyWith].visible;
        if (!using && !(cat.surface && !furniture[cat.surface]?.visible)) return;
        cat.release();
        cat.interrupt((function* fall() {
          cat.surface = null; cat.setPose('stand'); cat.face('annoyed');
          const y0 = cat.y;
          for (let t = 0; t < .35; t += world.dt) { cat.y = y0 * (1 - (t / .35) ** 2); yield; }
          cat.y = 0; cat.squash = 1;
          yield* cat.wait(.5);
          yield* cat.life();
        })());
      });
    },
    update(dt, t, afk) {
      world.dt = Math.min(dt, .05); world.time = t;
      if (afk && !world.afk) world.cats.forEach(cat => { if (!cat.carried) cat.interrupt(cat.nap()); });
      world.afk = afk;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += world.dt;
        const k = Math.min(1, tw.t / tw.duration);
        tw.fn(k);
        if (k === 1) { tweens.splice(i, 1); tw.done?.(); }
      }
      restoreToys();
      restoreBird();
      if (furniture.flowers?.visible) furniture.flowers.userData.walkers = world.cats.filter(cat => cat.y < .05); // hoa rạp khi mèo giẫm qua
      world.cats.forEach(cat => cat.update(world.dt, t));
      separate();
    },
    hit(raycaster) {
      const hit = raycaster.intersectObjects(world.cats.map(cat => cat.rig.root), true)[0];
      return hit?.object.userData.catRoot?.userData.cat || null;
    },
  };
}
