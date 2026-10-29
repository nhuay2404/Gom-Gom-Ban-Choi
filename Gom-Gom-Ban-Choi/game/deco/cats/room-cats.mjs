// Đàn mèo khối 3D sống trong phòng Deco/Home: đồ chơi từng khu, chọn hành vi cho từng con, vật cản, đồ rơi / lăn,
// tương tác nhiều mèo. Một con: cat-brain.mjs; khung: cat-rig.mjs; đường đi giữa các khu: cat-nav.mjs.
// Sang Unity: CatHerd (MonoBehaviour quản lý các CatBrain).
import * as THREE from 'three';
import { OBSTACLE_EXTRA, WINDOW } from '../room-layout.mjs';
import { TOON, toonMat } from '../render/toon.mjs';
import { rand, ROOM, W, clamp, chance, H, D } from './cat-math.mjs';
import { FURNITURE, SQUEEZE_SETTLE, CARRY_H, Cat } from './cat-brain.mjs';
import { zoneHome, boxNearest, PASSES } from './cat-nav.mjs';

// ---------- Cả đàn: chọn hành vi, vật cản, đồ chơi rơi/lăn ----------
// Độ thích từng món đồ (trọng số chọn hành vi), theo khu.
// Hammock variants that hang from a beam and swing like a pendulum (not a cloth sling).
export const hangsFromBeam = kind => kind === 'hammock-tire' || kind === 'hammock-basket' || kind === 'hammock-jp';

const GARDEN_TOYS = { flowers: .9, stump: 1.1, catnip: 1.2, lantern: .7, sandbox: 1, cathouse: 1.5, pond: 1.3, hammock: 1.4, birdbath: 1.1, bench: .9 };

const LIVING_TOYS = { catbed: 1.6, armchair: 1.3, cattree: 1.4, shelf: .9, table: 1.1, yarn: 1.3, plant: .8, tank: 1.4, lamp: .9 };

const BEDROOM_TOYS = { bed: 1.7, desk: 1.3, chair: 1, bedside: 1, closet: .8, catsteps: 1.3, plushie: 1.1, laundry: 1.4, mirror: .9 };

const GARDEN2_TOYS = { windmill: 1.1, sunflowers: 1, clothesline: 1.1, campfire: 1.3, kite: 1.2, stream: 1.3, swingtree: 1.5, slide: 1.6, birdhouse: 1, picnic: 1.2 };

const KITCHEN_TOYS = { fridge: .9, stove: 1.2, sink: 1.1, pantry: .8, dining: 1.2, kchair: 1, catfood: 1.8, cart: 1.1, kplant: .8, bakerack: .9 };

// Phòng tắm: chưa có tương tác mèo với đồ (mèo vẫn đi lại / ngủ trong phòng như mọi khu).
const BATHROOM_TOYS = {};

// Sân sau (bể bơi + vườn rau): chưa có tương tác mèo với đồ.
const BACKYARD_TOYS = {};

// Trường mẫu giáo: chưa có tương tác mèo với đồ.
const KINDER_TOYS = {};

export const ZONE_TOYS = { garden: GARDEN_TOYS, living: LIVING_TOYS, bedroom: BEDROOM_TOYS, kitchen: KITCHEN_TOYS, bathroom: BATHROOM_TOYS, garden2: GARDEN2_TOYS, backyard: BACKYARD_TOYS, backyard2: BACKYARD_TOYS, kinder: KINDER_TOYS, kinder2: KINDER_TOYS, flower: {} };

// Tương tác nhiều mèo với một món (xem stareDown / squeezeIn / watchTogether / copycat):
const RESTS = ['catbed', 'armchair', 'bed', 'chair', 'kchair', 'bench', 'hammock', 'stove', 'lamp', 'lantern']; // chỗ nằm ấm: tranh chỗ

const SQUEEZE = ['catbed']; // ổ đủ rộng để chen hai con

export const WATCH = ['window', 'tank', 'kite']; // đang ngắm: ngồi ngắm chung

const COPY = ['stump', 'sandbox', 'catnip']; // đang làm trò: bắt chước

// ctx.zones() = các khu đã mở (đọc lúc chạy: mở phòng khách không cần tạo lại đàn mèo).
export function createCatLife(ctx) {
  const { scene, furniture, heartsAt, symbolAt } = ctx;
  const tweens = [];
  const world = {
    scene, furniture, butterflies: ctx.butterflies, cats: [], claims: new Map(), dt: 0, time: 0, afk: false,
    sand(cat) { // hạt cát văng ra sau lưng mèo
      const grain = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), (TOON ? toonMat : p => new THREE.MeshStandardMaterial(p))({ color: '#f3dfb0' }));
      const x0 = cat.x, z0 = cat.z, back = cat.heading + Math.PI + rand(-.6, .6);
      scene.add(grain);
      world.tween(.45, k => grain.position.set(x0 + Math.sin(back) * k * .5, cat.y + .1 + Math.sin(k * Math.PI) * .3, z0 + Math.cos(back) * k * .5), () => scene.remove(grain));
    },
    splash(pond, cat) { // vòng sóng lan ra trên mặt ao
      const ring = new THREE.Mesh(new THREE.RingGeometry(.05, .08, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cat.x + Math.sin(cat.heading) * .45, .11, cat.z + Math.cos(cat.heading) * .45);
      scene.add(ring);
      world.notice(ring.position.x, ring.position.z, { except: cat, radius: 2.4, startle: true });
      world.tween(.9, k => { ring.scale.setScalar(1 + k * 5); ring.material.opacity = 1 - k; }, () => scene.remove(ring));
    },
    scareBird(bath) {
      const bird = bath.userData.bird;
      if (!bird || bird.userData.away) return;
      bird.userData.away = true;
      const from = bird.position.clone(), seen = bird.getWorldPosition(new THREE.Vector3());
      world.notice(seen.x, seen.z, { radius: 4 });
      world.tween(1.4, k => { bird.position.set(from.x + k * 2.5, from.y + k * 3, from.z - k * 1.5); bird.rotation.z = Math.sin(k * 40) * .3; },
        () => { bird.visible = false; bird.userData.returnAt = world.time + 12; });
    },
    obstacles(ignore) {
      return Object.entries(furniture).filter(([id, node]) => node.visible && id !== ignore && FURNITURE[id]?.r)
        .flatMap(([id, node]) => [{ x: node.position.x, z: node.position.z, r: FURNITURE[id].r },
          ...(OBSTACLE_EXTRA[id] || []).map(([dx, dz, r]) => ({ x: node.position.x + dx, z: node.position.z + dz, r }))])
        .concat((ctx.staticObstacles?.() || []).filter(ob => ob.id !== ignore)); // đồi ở phần vườn mở rộng
    },
    // Độ cao mặt đất tại (x, z) khu nhà (đồi ở phần vườn mở rộng; còn lại 0) và vật cản đồi (null nếu vườn chưa mở rộng).
    groundAt(x, z) { return ctx.groundAt?.(x, z) || 0; },
    hill() { return (ctx.staticObstacles?.() || []).find(ob => ob.id === 'hill') || null; },
    // ----- Khu nhà (xem ZONE_OFFSET / DOOR) -----
    zones() { return ctx.zones?.() || ['garden']; }, // các khu đã mở
    // Khu chứa điểm (x, z): khu đã mở có ô gần điểm nhất (trong lối cửa thì thuộc khu gần hơn).
    zoneAt(x, z) {
      let best = 'garden', bestD = Infinity;
      for (const zone of world.zones()) {
        const h = zoneHome(zone), p = boxNearest(x, z, h.x - ROOM, h.x + ROOM, h.z - ROOM, h.z + ROOM), d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bestD) { best = zone; bestD = d; }
      }
      return best;
    },
    // Điểm gần (x, z) nhất mà mèo đứng được: trong ô của một khu đã mở hoặc trong lối cửa giữa hai khu.
    // Lấy điểm gần nhất (không kẹp theo khu) nên mèo bước từ khu vào lối cửa liền mạch, không bị giật.
    bound(x, z) {
      let best = null, bestD = Infinity;
      const consider = p => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bestD) { best = p; bestD = d; } };
      for (const zone of world.zones()) { const h = zoneHome(zone); consider(boxNearest(x, z, h.x - ROOM, h.x + ROOM, h.z - ROOM, h.z + ROOM)); }
      for (const p of PASSES) if (world.zones().includes(p.a) && world.zones().includes(p.b)) for (const box of p.boxes) consider(boxNearest(x, z, ...box));
      return best;
    },
    // Cửa sổ vòm phòng khách theo toạ độ khu nhà.
    window() { const h = zoneHome('living'); return { x: h.x + WINDOW.x, z: h.z + WINDOW.z }; },
    // Chỗ trống trên sàn ngay dưới cửa sổ (cửa sổ rộng x -2.2..-1.0); null nếu đồ đạc che hết.
    windowSpot() {
      const win = world.window();
      for (const x of [win.x, win.x + .3, win.x - .3, win.x + .55, win.x - .5]) {
        if (!world.obstacles().some(ob => Math.hypot(x - ob.x, win.z - ob.z) < ob.r + .42)) return { x, z: win.z };
      }
      return null;
    },
    // Chỗ đáp khi thả mèo: đúng điểm thả, trừ khi trùng đồ đạc thì dời ra mép đồ gần nhất.
    landingSpot(cat) { return world.reachable(cat.x, cat.z); },
    // Điểm gần (x, z) nhất mà mèo đứng được: trong khu nhà và ngoài mọi vật cản.
    reachable(px, pz) {
      let { x, z } = world.bound(px, pz);
      for (const ob of world.obstacles()) {
        const dx = x - ob.x, dz = z - ob.z, d = Math.hypot(dx, dz) || 1e-4, reach = ob.r + W * .45;
        if (d < reach) ({ x, z } = world.bound(ob.x + dx / d * reach, ob.z + dz / d * reach));
      }
      return { x, z };
    },
    // Món mèo có thể tương tác gần điểm (x, z) nhất (trong tầm `reach` tính từ mép món), chưa có con nào đang dùng; không có thì null.
    // Người chơi thả mèo gần món nào thì mèo làm đúng hành vi của món đó (useFurniture).
    nearToy(x, z, reach = 1.1) {
      let best = null, bestGap = reach;
      for (const id of Object.keys({ ...GARDEN_TOYS, ...LIVING_TOYS, ...BEDROOM_TOYS, ...KITCHEN_TOYS, ...GARDEN2_TOYS })) {
        const node = furniture[id];
        if (!node?.visible || world.claims.has(id)) continue;
        const c = world.center(id), gap = Math.hypot(x - c.x, z - c.z) - Math.min(c.r, 1.2); // món to (cối xay + đồi) không được lấn món nhỏ ở cạnh
        if (gap < bestGap) { bestGap = gap; best = id; }
      }
      return best;
    },
    center(id) { const node = furniture[id]; return { x: node.position.x, z: node.position.z, r: FURNITURE[id]?.r || .5 }; },
    // Chỗ trống ngẫu nhiên trong một khu (mặc định khu mèo đang đứng). Bỏ chỗ khuất sau đồi (nhìn từ tâm khu bị đồi che):
    // góc giữa đồi và rào là ngõ cụt, mèo không đi tới được.
    freeSpot(cat, zone = world.zoneAt(cat.x, cat.z)) {
      const h = zoneHome(zone), hill = world.hill();
      const behindHill = (x, z) => {
        if (!hill) return false;
        const dx = x - h.x, dz = z - h.z, len = Math.hypot(dx, dz) || 1e-4, t = clamp(((hill.x - h.x) * dx + (hill.z - h.z) * dz) / len, 0, len);
        return Math.hypot(h.x + dx / len * t - hill.x, h.z + dz / len * t - hill.z) < hill.r;
      };
      for (let i = 0; i < 30; i++) {
        const x = h.x + rand(-ROOM + .3, ROOM - .3), z = h.z + rand(-ROOM + .3, ROOM - .3);
        if (Math.hypot(x - cat.x, z - cat.z) < .8 || behindHill(x, z)) continue;
        if (world.obstacles().some(ob => Math.hypot(x - ob.x, z - ob.z) < ob.r + .4)) continue;
        if (world.cats.some(other => other !== cat && Math.hypot(x - other.x, z - other.z) < .7)) continue;
        return { x, z };
      }
      return { x: h.x + rand(-1, 1), z: h.z + rand(-1, 1) };
    },
    choose(cat, last) {
      const options = [];
      const add = (name, weight, make) => { if (weight > 0 && name !== last) options.push([name, weight, make]); };
      add('wander', 3, () => cat.wander());
      add('sit', 1.4, () => cat.idleSit());
      add('groom', 1.2, () => cat.groom());
      add('stretch', .5, () => cat.yawnStretch());
      add('zoomies', .35, () => cat.zoomies());
      add('nap', ctx.night ? 2.4 : .7, () => cat.loafNap()); // ban đêm mèo hay ngủ
      add('tailchase', ctx.night ? .1 : .35, () => cat.tailChase());
      add('pounce', ctx.night ? .15 : .55, () => cat.pounceBug());
      add('bellyroll', .4, () => cat.bellyRoll());
      add('meow', .45, () => cat.meowAtYou());
      // Mèo chơi chủ yếu ở khu đang đứng; thỉnh thoảng đi qua cửa sang khu kia (dạo chơi, hoặc tới thẳng một món đồ bên đó).
      const zone = world.zoneAt(cat.x, cat.z), garden = zone === 'garden';
      const others = world.zones().filter(z => z !== zone), other = others[Math.floor(Math.random() * others.length)];
      const there = id => ZONE_TOYS[zone][id] === undefined ? .25 : 1; // món ở khu khác: ít chọn hơn
      if (other) add('roam', .6, () => cat.wander(other));
      if (zone === 'living' && !world.claims.has('window')) add('window', .8, () => cat.lookOutWindow());
      if (garden && !ctx.night) add('butterfly', 1.1, () => cat.chaseButterfly()); // đêm bướm đi ngủ
      if (furniture.rug?.visible && !world.claims.has('rug')) add('rug', .6 * (garden ? .25 : 1), () => cat.rollOnRug());
      if (zone === 'garden2' && world.hill() && !world.claims.has('hill')) add('hill', .9, () => cat.hillTop());
      for (const [id, weight] of Object.entries({ ...GARDEN_TOYS, ...LIVING_TOYS, ...BEDROOM_TOYS, ...KITCHEN_TOYS, ...GARDEN2_TOYS })) {
        if (furniture[id]?.visible && !world.claims.has(id)) add(id, weight * there(id), () => cat.useFurniture(id));
      }
      const buddies = world.cats.filter(other => other !== cat && other.interruptible() && other.y < .01 && world.zoneAt(other.x, other.z) === zone);
      if (buddies.length) {
        const other = buddies[Math.floor(Math.random() * buddies.length)];
        add('boop', 1, () => cat.boop(other));
        add('chase', .6, () => cat.chase(other));
        add('groomBuddy', .5, () => cat.groomBuddy(other));
        add('playfight', ctx.night ? .15 : .6, () => cat.playFight(other));
        add('cuddle', ctx.night ? 1.2 : .4, () => cat.cuddleNap(other));
        add('sniff', .5, () => cat.sniffTail(other));
        add('pounceTail', ctx.night ? .15 : .55, () => cat.pounceTail(other));
        add('follow', ctx.night ? .15 : .45, () => cat.follow(other));
        add('bunt', .7, () => cat.headBunt(other));
        add('tag', ctx.night ? .15 : .8, () => cat.tag(other));
      }
      if (world.cats.some(o => o !== cat && world.zoneAt(o.x, o.z) === zone)) add('ambush', ctx.night ? .15 : .6, () => cat.ambush());
      // Bạn đang dùng một món: tranh chỗ / chen vào nằm chung / ngắm chung / bắt chước. Mỗi kiểu chỉ một con làm cùng lúc
      // (không ba con chen một ổ, không cả đàn đứng nhìn chằm chằm một con).
      const doing = new Set(world.cats.map(o => o.busyWith));
      for (const o of world.cats) {
        if (o === cat || o.carried || o.social || o.napping || !o.busyWith || world.zoneAt(o.x, o.z) !== zone) continue;
        if (['stare', 'squeeze', 'watch', 'copycat'].some(kind => doing.has(kind))) break;
        const id = o.busyWith, resting = o.sleeping || o.surface === id;
        if (RESTS.includes(id) && resting) add('stare', .8, () => cat.stareDown(o, id));
        if (SQUEEZE.includes(id) && o.surface === id) add('squeeze', 1.3, () => cat.squeezeIn(o, id));
        if (WATCH.includes(id) && o.y < .01) add('watch', 1.6, () => cat.watchTogether(o));
        if (COPY.includes(id) && o.y < .01) add('copy', 1.5, () => cat.copycat(o));
      }
      // Lửa trại lúc chiều tối / đêm: có con đang sưởi thì kéo tới nằm vòng quanh (tối đa 3 con quanh lửa).
      const fire = furniture.campfire, warming = world.claims.get('campfire');
      if (fire?.visible && fire.userData.itemId !== 'campfire-tent' && (ctx.night || ctx.ambient === 'dusk') && warming && warming !== cat
        && zone.startsWith('garden') && world.cats.filter(o => o.ringFire).length < 2) add('campfireRing', 2.6, () => cat.joinCampfire());
      let roll = Math.random() * options.reduce((sum, [, w]) => sum + w, 0);
      for (const [name, weight, make] of options) { roll -= weight; if (roll <= 0) return [name, make()]; }
      return ['wander', cat.wander()];
    },
    tween(duration, fn, done) { tweens.push({ t: 0, duration, fn, done }); },
    // Có động (cốc rơi, chim bay, mèo kêu, khè...): con ở gần ngoái nhìn về phía đó, tai dỏng;
    // con đang ngủ chỉ giật tai; startle = ở sát thì giật mình (vươn người, cụp tai, xù đuôi).
    notice(x, z, { except = null, radius = 3.2, startle = false } = {}) {
      for (const c of world.cats) {
        if (c === except || c.carried) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d > radius) continue;
        c.earSide = chance(.5) ? 0 : 1; c.earTwitchV = (c.earTwitchV || 0) + 18;
        if (c.sleeping) continue;
        c.attention = { x, z, until: world.time + rand(1.2, 2.2) };
        if (startle && d < 1.6 && c.y < .01) { c.squash = -.35; c.squashV = 0; c.earFlopV = (c.earFlopV || 0) + 12; c.puffUntil = world.time + 1.2; }
      }
    },
    // D1 Đồ rơi "cạch": con đang ngủ gần đó giật mình tỉnh; con tò mò nhất (thức, gần nhất) chạy tới ngửi xem.
    commotion(x, z, culprit) {
      const woken = new Set(); // não mới chỉ chạy từ frame sau (occupy chưa kịp đánh dấu bận): loại trừ thẳng ở đây
      for (const c of world.cats) {
        if (c === culprit || !c.sleeping || c.napping || c.carried || c.social || Math.hypot(c.x - x, c.z - z) > 3.5 || !chance(.7)) continue;
        c.interrupt(c.wakeStartled(x, z)); woken.add(c);
      }
      const curious = world.cats.filter(c => c !== culprit && !woken.has(c) && c.interruptible() && Math.hypot(c.x - x, c.z - z) < 6)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      if (curious && chance(.75)) curious.interrupt(curious.inspectSpot(x, z, culprit));
    },
    // D2 Một con chạy loạn: con gần nhất (thức, rảnh, cùng khu) có khi hứng lên chạy theo.
    spreadZoomies(from) {
      const zone = world.zoneAt(from.x, from.z);
      const near = world.cats.filter(c => c !== from && c.interruptible() && world.zoneAt(c.x, c.z) === zone && Math.hypot(c.x - from.x, c.z - from.z) < 4.5)
        .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0];
      if (near && chance(.5)) world.tween(rand(.3, .8), () => {}, () => { if (near.interruptible()) near.interrupt(near.catchZoomies(from)); });
    },
    jealousy(target) {
      if (world.cats.some(c => c.social === 'jealous')) return;
      const rivals = world.cats.filter(c => c !== target && c.interruptible());
      const rival = rivals[Math.floor(Math.random() * rivals.length)];
      rival?.interrupt(rival.jealous(target));
    },
    // Ký hiệu nổi trên đầu một con (💢 / ♪ / …).
    say(cat, symbol, count = 1) { symbolAt?.(new THREE.Vector3(cat.x, cat.y + H + .25, cat.z), symbol, count); },
    cameraPos: () => ctx.cameraPos?.(),
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
        const at = mug.getWorldPosition(new THREE.Vector3());
        world.notice(at.x, at.z, { except: cat, radius: 5, startle: true }); // cả nhà giật mình quay lại nhìn
        world.commotion(at.x, at.z, cat);
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
      ({ x: target.x, z: target.z } = world.bound(target.x, target.z)); target.y = .19;
      const to = basket.worldToLocal(target.clone());
      to.y = .19;
      world.tween(.6, k => {
        const e = 1 - (1 - k) ** 2;
        toy.position.set(from.x + (to.x - from.x) * e, .19 + Math.abs(Math.sin(k * Math.PI * 2)) * .08 * (1 - k), from.z + (to.z - from.z) * e);
        toy.rotation.x += .3;
      });
      toy.userData.restoreAt = world.time + 6;
      world.notice(target.x, target.z, { except: cat, radius: 2.2 });
    },
  };

  // Không cho mèo lồng vào nhau hay xuyên đồ đạc: sau khi di chuyển, đẩy tách mọi cặp đang chồng lên nhau.
  // Chỉ áp cho mèo đứng trên sàn (đang nhảy hoặc đang ngồi trên đồ thì bỏ qua), và bỏ qua món mèo đang dùng.
  // Theo cạnh dài nhất của thân + chừa chỗ cho tư thế nằm duỗi / đuôi: hai mèo cạnh nhau không đè lên nhau.
  const CAT_GAP = Math.max(W, D) + .14;
  const grounded = cat => cat.y < .01 && !cat.airPitch;
  function pushOutOfFurniture(cat) {
    for (const ob of world.obstacles(cat.busyWith)) {
      const dx = cat.x - ob.x, dz = cat.z - ob.z, d = Math.hypot(dx, dz) || 1e-4, reach = ob.r + W * .45;
      if (d < reach) ({ x: cat.x, z: cat.z } = world.bound(ob.x + dx / d * reach, ob.z + dz / d * reach));
    }
  }
  function separate() {
    const before = world.cats.map(cat => [cat.x, cat.z]);
    resolveOverlaps();
    world.cats.forEach((cat, i) => { cat.corrX = (cat.corrX || 0) + cat.x - before[i][0]; cat.corrZ = (cat.corrZ || 0) + cat.z - before[i][1]; });
  }
  function resolveOverlaps() {
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
          // Đang len qua nhau thì không đẩy; vừa len xong thì tách ra từ từ (mỗi lượt ≤ 1.5 cm), không bật giật
          const now = world.time, until = Math.max(a.squeezeUntil || 0, b.squeezeUntil || 0);
          if (now < until) continue;
          const half = Math.min((CAT_GAP - d) / 2, now < until + SQUEEZE_SETTLE ? .015 : Infinity);
          ({ x: a.x, z: a.z } = world.bound(a.x - ux * half, a.z - uz * half));
          ({ x: b.x, z: b.z } = world.bound(b.x + ux * half, b.z + uz * half));
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
    for (const id of ['table', 'yarn', 'bedside', 'clothesline', 'dining', 'cart']) {
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
    // Đàn mèo (chỉ đọc: x, z, y, speed, carried) để cảnh làm đồ đạc rung nhẹ khi mèo đi sát qua.
    bodies() { return world.cats; },
    pickUp(cat, x, z) {
      cat.carried = true; cat.petUntil = 0;
      ({ x: cat.carryX, z: cat.carryZ } = world.bound(x, z));
      cat.interrupt(cat.beCarried());
    },
    carryTo(cat, x, z) { ({ x: cat.carryX, z: cat.carryZ } = world.bound(x, z)); }, // bế mèo sang khu kia cũng được
    drop(cat) { cat.carried = false; },
    // Hướng dẫn: giữ con mèo giống `breed` ngồi yên nhìn camera (on) / thả cho đi lại (off).
    // Lúc bắt đầu giữ, mèo chạy / đi tới (không dịch chuyển tức thời) chỗ mặc định của hướng dẫn: giữa vườn, lùi về phía xa camera (sau bồn hoa giữa vườn) để
    // khi camera lướt / zoom tới món ở giữa vườn mèo vẫn nằm trong khung, không tụt xuống sau thanh UI dưới đáy.
    // near {x, z}: món hướng dẫn sắp chỉ tới — mèo ngồi ngay bên cạnh (ngang theo màn hình, về phía giữa vườn) thay vì sau bồn hoa.
    // avoid [{x, z}]: chỗ có vật tạm (hộp quà onboarding) — chỗ ngồi bên nào sát nó < 1 m thì ngồi bên kia.
    hold(breed, on, near = null, avoid = []) {
      const cat = world.cats.find(c => c.breed === breed);
      if (!cat || !!cat.held === on) return;
      cat.held = on;
      cat.settled = false;
      if (!on) return;
      if (near === 'here') return cat.interrupt(cat.holdStill());
      const h = zoneHome('garden'), cam = world.cameraPos?.();
      const away = cam ? Math.atan2(h.x - cam.x, h.z - cam.z) : 0;
      if (near) {
        const side = Math.sin(away + Math.PI / 2) * (h.x - near.x) + Math.cos(away + Math.PI / 2) * (h.z - near.z) >= 0 ? 1 : -1;
        // 1.7 m: gần hơn thì khung sáng của món (hướng dẫn Deco) cắt ngang người mèo.
        const spotAt = s => { const a = away + s * Math.PI / 2; return world.reachable(near.x + Math.sin(a) * 1.7, near.z + Math.cos(a) * 1.7); };
        const blocked = p => avoid.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 1);
        const spot = blocked(spotAt(side)) && !blocked(spotAt(-side)) ? spotAt(-side) : spotAt(side);
        cat.interrupt(cat.holdStill(spot));
      } else cat.interrupt(cat.holdStill(world.reachable(h.x + Math.sin(away) * ROOM * .45, h.z + Math.cos(away) * ROOM * .45)));
    },
    // Mèo đang được giữ (hold) đã đi tới chỗ ngồi và ngồi yên chưa (hướng dẫn chờ cái này rồi mới hiện bong bóng mọc từ mèo).
    settled(breed) { return !!world.cats.find(c => c.breed === breed)?.settled; },
    // Onboarding (thùng mèo sau màn 1, deco-room.mjs openCatBox): mèo `breed` nằm giấu trong thùng ở (x, z), đứng yên tới khi thùng mở.
    hideIn(breed, x, z) {
      const cat = world.cats.find(c => c.breed === breed);
      if (!cat) return;
      cat.release();
      Object.assign(cat, { x, z, y: 0, surface: null });
      cat.rig.root.visible = false;
      cat.interrupt((function* stayHidden() { cat.setPose('sit'); for (;;) yield; })());
    },
    // Thùng vừa mở: mèo hiện ra ở miệng thùng `from` {x, y, z}, nhảy vòng cung đáp xuống đất ở `to` {x, z}, ngồi một nhịp rồi sống bình thường.
    popOut(breed, from, to) {
      const cat = world.cats.find(c => c.breed === breed);
      if (!cat) return;
      cat.rig.root.visible = true;
      cat.release();
      cat.interrupt((function* hop() {
        // Nhảy xa (từ thùng ở lề đường qua rào vào vườn) thì bay lâu + cao hơn.
        const land = world.reachable(to.x, to.z), y1 = world.groundAt(land.x, land.z), far = Math.hypot(land.x - from.x, land.z - from.z);
        const JUMP = Math.max(.7, far * .28), HIGH = Math.max(.8, far * .4);
        Object.assign(cat, { x: from.x, y: from.y, z: from.z, surface: null });
        cat.heading = cat.yaw = cat.facing(land.x, land.z);
        cat.setPose('stand'); cat.face('happy');
        for (let t = 0; t < JUMP; t += world.dt) {
          const k = t / JUMP;
          cat.x = from.x + (land.x - from.x) * k; cat.z = from.z + (land.z - from.z) * k;
          cat.y = from.y + (y1 - from.y) * k + Math.sin(k * Math.PI) * HIGH;
          yield;
        }
        Object.assign(cat, { x: land.x, y: y1, z: land.z, squash: 1 });
        cat.setPose('sit');
        yield* cat.wait(1);
        cat.setPose('stand');
        yield* cat.life();
      })());
    },
    setCats(breeds) {
      const keep = [];
      breeds.forEach(breed => {
        const existing = world.cats.find(cat => cat.breed === breed && !keep.includes(cat));
        if (existing) keep.push(existing);
        else {
          const zones = world.zones(), spot = world.freeSpot({ x: 99, z: 99 }, zones[Math.floor(Math.random() * zones.length)]); // mèo mới: ở khu bất kỳ
          keep.push(new Cat(world, breed, spot.x, spot.z));
        }
      });
      world.cats.filter(cat => !keep.includes(cat)).forEach(cat => { cat.release(); cat.dispose(); });
      world.cats = keep;
    },
    // Món đồ bị gỡ khi mèo đang ngồi trên / đang dùng: mèo rơi xuống sàn rồi làm việc khác.
    // fresh: các chỗ vừa đặt món mới / đổi phương án (người chơi vừa trang trí). D3: cả đàn quay đầu nhìn, con tò mò nhất
    // (gần nhất, đang rảnh, cùng khu) tới ngửi, cọ má (D4) rồi dùng thử.
    furnitureChanged(fresh = []) {
      const sent = new Set(); // mỗi con chỉ đi xem một món (não mới chưa chạy nên interruptible() vẫn còn true)
      for (const id of fresh) {
        const node = furniture[id];
        if (!node?.visible) continue;
        const c = world.center(id), zone = world.zoneAt(c.x, c.z);
        world.notice(c.x, c.z, { radius: 7 });
        const curious = world.cats.filter(cat => !sent.has(cat) && cat.interruptible() && world.zoneAt(cat.x, cat.z) === zone)
          .sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
        if (curious && chance(.85)) { curious.interrupt(curious.inspectNew(id)); sent.add(curious); }
      }
      world.cats.forEach(cat => {
        if (cat.carried) return;
        const using = cat.busyWith && furniture[cat.busyWith] && !furniture[cat.busyWith].visible;
        if (!using && !(cat.surface && !furniture[cat.surface]?.visible)) return;
        cat.release();
        cat.interrupt((function* fall() {
          cat.surface = null; cat.setPose('stand'); cat.face('annoyed');
          const y0 = cat.y, floor = world.groundAt(cat.x, cat.z);
          for (let t = 0; t < .35; t += world.dt) { cat.y = floor + (y0 - floor) * (1 - (t / .35) ** 2); yield; }
          cat.y = floor; cat.squash = 1;
          yield* cat.wait(.5);
          yield* cat.life();
        })());
      });
    },
    update(dt, t, afk) {
      world.dt = Math.min(dt, .05); world.time = t;
      // AFK: không cả đàn lăn ra ngủ cùng lúc. Mỗi con buồn ngủ ở một thời điểm ngẫu nhiên (vài giây .. ~25 giây),
      // trong lúc chờ vẫn sống bình thường; hết AFK thì mỗi con tỉnh lệch nhau một chút (xem nap()).
      if (afk && !world.afk) world.cats.forEach((cat, i) => { cat.napAt = t + (i === 0 ? rand(1.5, 5) : rand(4, 26)); });
      if (!afk) world.cats.forEach(cat => { cat.napAt = null; });
      else world.cats.forEach(cat => {
        if (cat.napAt && t >= cat.napAt && !cat.carried && !cat.napping && !cat.held) { cat.napAt = null; cat.interrupt(cat.nap()); }
      });
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
      for (const node of Object.values(furniture)) if (node.visible && node.userData.watchCats) node.userData.cats = world.cats; // hướng dương nhìn theo mèo
      world.cats.forEach(cat => cat.update(world.dt, t));
      separate();
    },
    hit(raycaster) {
      // Bỏ con đang ẩn (nằm trong thùng thú cưng, hideIn): raycast không xét `visible`, không lọc thì nó chặn cú chạm vào thùng.
      const hit = raycaster.intersectObjects(world.cats.filter(cat => cat.rig.root.visible).map(cat => cat.rig.root), true)[0];
      return hit?.object.userData.catRoot?.userData.cat || null;
    },
  };
}
