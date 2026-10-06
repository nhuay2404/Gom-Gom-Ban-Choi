// Hiệu ứng hạt nhẹ cho Deco (Three.js): xem trước món, đổi kiểu món, mua món thành công.
// Hạt là Sprite (luôn quay mặt về camera) + một vòng sáng phẳng trên sàn; nằm trên DECAL_LAYER nên pass ID của viền toon
// (chỉ vẽ lớp 0) bỏ qua chúng, không làm sai viền đồ đạc. Không đổ bóng, không chặn chạm.
import * as THREE from 'three';
import { DECAL_LAYER } from './toon.mjs';

// Ảnh hạt vẽ bằng canvas: chấm mềm (khói / pháo giấy) và sao 4 cánh (lấp lánh).
function texture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  draw(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const DOT = texture(g => {
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, '#fff'); grad.addColorStop(.55, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});
const STAR = texture(g => {
  const glow = g.createRadialGradient(32, 32, 0, 32, 32, 20);
  glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 6 : 30, a = i * Math.PI / 4 - Math.PI / 2;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
});
const CONFETTI = ['#ff6f91', '#ffd23f', '#5fbe57', '#5ab8ff', '#b48cf0', '#ff9f43'];

// Các kiểu: preview (lấp lánh nhẹ bay lên) / swap (làn khói quanh chân + lấp lánh) / buy (pháo giấy + sao + vòng sáng vàng).
export function createDecoFx(scene) {
  const live = [];
  const ringGeo = new THREE.RingGeometry(.82, 1, 48);
  function sprite(map, color, size) {
    const node = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, opacity: 0 }));
    node.layers.set(DECAL_LAYER);
    node.renderOrder = 3;
    node.scale.setScalar(size);
    scene.add(node);
    return node;
  }
  // p: { node, vel, gravity, drag, life, delay, size0, size1, fadeIn, spin }
  function spawn(p) { p.age = -(p.delay || 0); live.push(p); }
  const rand = (a, b) => a + Math.random() * (b - a);
  function ring(at, radius, color, life) {
    const node = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
    node.rotation.x = -Math.PI / 2;
    node.position.copy(at).setY(at.y + .03);
    node.layers.set(DECAL_LAYER);
    node.renderOrder = 3;
    node.userData.noOutline = true;
    scene.add(node);
    spawn({ node, ring: true, radius, life, size0: radius * .25, size1: radius, peak: .9 });
  }
  // base: chân món (mặt sàn), top: độ cao đỉnh món, span: bề ngang món (m)
  function burst(kind, base, top, span) {
    const r = Math.max(.35, span / 2);
    if (kind === 'preview') {
      for (let i = 0; i < 9; i++) {
        const a = rand(0, Math.PI * 2), d = r * rand(.5, 1.05);
        spawn({ node: sprite(STAR, '#fff6c8', .1), pos: new THREE.Vector3(base.x + Math.cos(a) * d, base.y + rand(.1, top * .9 + .1), base.z + Math.sin(a) * d),
          vel: new THREE.Vector3(0, rand(.35, .7), 0), drag: .5, life: rand(.7, 1.1), delay: i * .04, size0: .05, size1: rand(.16, .26), peak: .95, twinkle: true });
      }
      ring(base, r * 1.3, '#fff3b0', .6);
    }
    if (kind === 'swap') {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2 + rand(-.15, .15);
        spawn({ node: sprite(DOT, '#ffffff', .2), pos: new THREE.Vector3(base.x + Math.cos(a) * r * .5, base.y + rand(.05, .3), base.z + Math.sin(a) * r * .5),
          vel: new THREE.Vector3(Math.cos(a) * rand(1, 1.8), rand(.2, .7), Math.sin(a) * rand(1, 1.8)), drag: 3.2, life: rand(.55, .8), size0: .25, size1: rand(.55, .8), peak: .85 });
      }
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2);
        spawn({ node: sprite(STAR, '#fff6c8', .1), pos: new THREE.Vector3(base.x + Math.cos(a) * r * .7, base.y + rand(.2, top * .8 + .2), base.z + Math.sin(a) * r * .7),
          vel: new THREE.Vector3(0, rand(.4, .8), 0), drag: .6, life: rand(.6, .9), delay: .08 + i * .04, size0: .05, size1: .22, peak: 1, twinkle: true });
      }
    }
    if (kind === 'buy') {
      for (let i = 0; i < 30; i++) {
        const a = rand(0, Math.PI * 2), speed = rand(1.6, 3.2);
        spawn({ node: sprite(DOT, CONFETTI[i % CONFETTI.length], .12), pos: new THREE.Vector3(base.x, base.y + top * .6 + .2, base.z),
          vel: new THREE.Vector3(Math.cos(a) * speed * .6, rand(2.6, 4.2), Math.sin(a) * speed * .6), gravity: 6.5, drag: 1.1,
          life: rand(1, 1.5), size0: .14, size1: rand(.1, .16), peak: 1 });
      }
      for (let i = 0; i < 12; i++) {
        const a = rand(0, Math.PI * 2), d = r * rand(.3, 1);
        spawn({ node: sprite(STAR, '#ffe680', .1), pos: new THREE.Vector3(base.x + Math.cos(a) * d, base.y + rand(.1, top + .2), base.z + Math.sin(a) * d),
          vel: new THREE.Vector3(0, rand(.6, 1.1), 0), drag: .6, life: rand(.8, 1.2), delay: .05 + i * .035, size0: .06, size1: rand(.24, .36), peak: 1, twinkle: true });
      }
      ring(base, r * 1.8, '#ffd23f', .75);
      ring(base, r * 1.2, '#fff6c8', .55);
    }
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      if (p.age < 0) continue; // chờ tới lượt (xếp nhịp cho mềm)
      const k = Math.min(1, p.age / p.life), m = p.node.material;
      if (p.ring) {
        p.node.scale.setScalar(p.size0 + (p.size1 - p.size0) * (1 - (1 - k) ** 3));
        m.opacity = p.peak * (1 - k) ** 1.5;
      } else {
        if (p.pos) { p.node.position.copy(p.pos); p.pos = null; }
        p.vel.multiplyScalar(Math.exp(-(p.drag || 0) * dt));
        if (p.gravity) p.vel.y -= p.gravity * dt;
        p.node.position.addScaledVector(p.vel, dt);
        // hiện nhanh (12% đầu), mờ dần về cuối; lấp lánh thì nhấp nháy nhẹ
        const fade = k < .12 ? k / .12 : 1 - ((k - .12) / .88) ** 2;
        m.opacity = Math.max(0, p.peak * fade * (p.twinkle ? .75 + .25 * Math.sin(p.age * 30) : 1));
        p.node.scale.setScalar(p.size0 + (p.size1 - p.size0) * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2));
        if (p.twinkle) m.rotation += dt * 2;
      }
      if (k >= 1) { scene.remove(p.node); m.dispose(); live.splice(i, 1); }
    }
  }
  return { burst, update };
}
