// Phòng tắm (phía sau phòng ngủ, cửa giữa tường sau phòng ngủ): bộ đồ cho Deco — bồn cầu, bồn rửa mặt, bồn tắm, buồng tắm đứng,
// máy giặt, giá khăn, khay cát của mèo, thảm, bồn sục lớn giữa phòng — mỗi chỗ có 3 lựa chọn (món gốc + 2 phương án) + đồ trang trí cố định (rèm cửa sổ,
// kệ đồ tắm, giấy vệ sinh, tranh, thảm chùi chân, thùng rác). Cùng kiểu dựng với kitchen-scene.mjs: khối bo tròn, màu pastel, viền toon.
// Mỗi món có chỗ đặt cố định [x, z, xoay?] (room-layout.mjs PLACES); +z của món hướng vào giữa phòng, -z quay vào tường.
// Chưa có tương tác mèo với các món này (room-cats.mjs BATHROOM_TOYS rỗng); điểm neo seat / top ghi sẵn cho sau này.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { ROOM_HALF, BATHROOM_DOOR, BATHROOM_WINDOW_X } from './room-layout.mjs';
import { TOON, toonMat } from './toon.mjs';

const HALF = ROOM_HALF;
const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
const ROUND = 3;
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
const ring = (r, tube, color) => mesh(new THREE.TorusGeometry(r, tube, 8, Math.max(16, radialSegments(r) + 6)), color);
const cone = (r, h, color, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
const chrome = () => mat('#c8ccd2', { metalness: .8, roughness: .35 });
// Kính buồng tắm: tấm mỏng trong suốt, không viền toon (viền inverted hull phủ tối cả tấm kính).
function glassPane(w, h, d) {
  const pane = mesh(new THREE.BoxGeometry(w, h, d), mat('#cfeaf6', { transparent: true, opacity: .32 }));
  pane.castShadow = false;
  pane.userData.noOutline = true;
  return pane;
}
// Khăn tắm gấp vắt trên thanh: tấm bo tròn mỏng + viền sọc ở mép dưới.
const towelCloth = (w, h, color, stripe) => group(rbox(w, h, .05, .02, color), at(box(w + .01, .05, .06, stripe), 0, -h / 2 + .09, 0));

// ---------- Bồn cầu: két nước sát tường, bệ + nắp ngồi (seat = mặt nắp) ----------
function toiletBase({ body, seat, lid, tank = body, button = chrome() }) {
  const t = group(
    at(cyl(.15, .19, .36, body), 0, .18, .04),                                   // chân bệ
    squash(at(cyl(.22, .17, .14, body), 0, .41, .07), 1, 1, 1.25),              // lòng bồn
    squash(at(ring(.17, .03, seat), 0, .49, .07).rotateX(Math.PI / 2), 1, 1.25, 1), // vành ngồi
    squash(at(cyl(.2, .2, .03, lid), 0, .535, .07), 1, 1, 1.22),                 // nắp đậy
    at(rbox(.48, .5, .2, .05, tank), 0, .82, -.2),                              // két nước
    at(rbox(.52, .05, .24, .02, tank), 0, 1.095, -.2),                          // nắp két
    at(cyl(.035, .035, .02, button), 0, 1.13, -.2));
  t.userData.seat = [0, .55, .07];
  return t;
}

// ---------- Bồn rửa mặt: tủ / chân đỡ + chậu + vòi + gương treo phía trên (gương gắn liền món) ----------
function tap(chr, z = -.16, y = .87) {
  return group(at(cyl(.025, .03, .04, chr, 12), 0, y + .02, z), at(cyl(.012, .012, .16, chr, 8), 0, y + .1, z),
    at(cyl(.011, .011, .12, chr, 8), 0, y + .18, z + .06).rotateX(Math.PI / 2));
}
function mirror(w, h, frame, y = 1.62) {
  return group(at(rbox(w, h, .04, .02, frame), 0, y, -.22), at(rbox(w - .1, h - .1, .02, .009, '#dff3f8'), 0, y, -.185));
}

// ---------- Bồn tắm dọc tường sau (dài theo x 1.6 m, sâu .75): lòng bồn có mặt nước, thành bồn bao quanh ----------
function tubRim(color, y = .645) {
  return [at(box(1.6, .07, .08, color), 0, y, .335), at(box(1.6, .07, .08, color), 0, y, -.335),
    at(box(.08, .07, .75, color), .76, y, 0), at(box(.08, .07, .75, color), -.76, y, 0)];
}
const water = (color = '#9fdcf7') => at(box(1.44, .03, .6, color), 0, .615, 0);
const tubTap = chr => group(at(cyl(.03, .03, .2, chr, 10), 0, .78, -.33), at(cyl(.014, .014, .16, chr, 8), 0, .87, -.27).rotateX(Math.PI / 2), at(ball(.035, chr), 0, .87, -.19));

// ---------- Buồng tắm đứng ở góc sau-trái (khay 1.1 × 1.1, kính hai mặt hướng vào phòng, vòi sen ở góc tường) ----------
function showerTray(color) {
  return [at(rbox(1.1, .08, 1.1, .03, color), 0, .04, 0), at(cyl(.05, .05, .01, chrome(), 16), .1, .085, .1)];
}
function showerHead(chr, y = 1.95, square = false) {
  const arm = at(cyl(.016, .016, .34, chr, 8), -.38, y + .05, -.4).rotateX(Math.PI / 2);
  const head = square ? at(rbox(.3, .03, .3, .012, chr), -.38, y, -.24) : squash(at(cyl(.1, .07, .05, chr), -.38, y - .02, -.24), 1, 1, 1);
  return [at(cyl(.016, .016, y - .1, chr, 8), -.5, (y - .1) / 2 + .08, -.5), arm, head,
    at(rbox(.12, .06, .06, .02, chr), -.5, 1.05, -.47)]; // tay gạt
}

// ---------- Máy giặt áp tường phải: thân hộp, cửa tròn có kính, bảng nút ----------
function washerBody(body, trim, y = 0) {
  return [at(rbox(.6, .84, .6, .05, body), 0, y + .44, 0),
    at(ring(.19, .03, trim), 0, y + .4, .31),
    at(cyl(.17, .17, .02, mat('#bfe3ff', { transparent: true, opacity: .7 }), 28), 0, y + .4, .325).rotateX(Math.PI / 2),
    at(box(.54, .1, .02, trim), 0, y + .76, .31), at(cyl(.03, .03, .02, '#e8617f', 12), .18, y + .76, .325).rotateX(Math.PI / 2),
    at(ball(.018, '#7fc45a'), -.15, y + .76, .325), at(ball(.018, '#ffd66b'), -.08, y + .76, .325),
    ...[-.24, .24].flatMap(x => [-.24, .24].map(z => at(cyl(.03, .03, .02, '#6b7078', 10), x, y + .01, z)))];
}

// ---------- Khay cát của mèo ----------
const tray = (color, sand = '#efdcb0') => [at(rbox(.62, .14, .46, .04, color), 0, .07, 0), at(box(.54, .02, .38, sand), 0, .145, 0)];
const scoop = color => group(at(rbox(.12, .015, .1, .006, color), 0, 0, 0), at(cyl(.008, .008, .16, color, 6), 0, .01, .12).rotateX(Math.PI / 2));

export const BATHROOM_BUILD = {
  // ===== Bồn cầu =====
  toilet() { return toiletBase({ body: '#ffffff', seat: '#f5f8fb', lid: '#ffffff' }); },
  'toilet-wood'() { return toiletBase({ body: '#ffffff', seat: '#c98a55', lid: '#b9824f', tank: '#fffaf0', button: mat('#c98a55') }); },
  'toilet-kitty'() {
    const t = toiletBase({ body: '#ffd9e2', seat: '#ffc9d5', lid: '#ffb3c4', tank: '#ffd9e2', button: mat('#e8617f') });
    // Tai mèo trên nắp két + dấu chân trên nắp ngồi.
    t.add(...[-1, 1].map(s => at(cone(.07, .12, '#ffb3c4', 4), s * .16, 1.18, -.2).rotateY(Math.PI / 4)),
      at(cyl(.05, .05, .012, '#ffffff', 16), 0, .555, .1), ...[-.06, 0, .06].map(x => at(cyl(.018, .018, .012, '#ffffff', 10), x, .555, .02)));
    return t;
  },

  // ===== Bồn rửa mặt (áp tường trái) =====
  vanity() {
    const body = '#bfe8d6', chr = chrome();
    return group(at(box(.84, .04, .44, '#8fa89c'), 0, .02, 0), at(rbox(.9, .78, .5, .04, body), 0, .43, 0),
      at(rbox(.96, .05, .56, .02, '#fffaf0'), 0, .845, 0), at(cyl(.2, .15, .06, '#ffffff'), 0, .9, .02),
      ...[-.22, .22].flatMap(x => [at(rbox(.4, .6, .03, .014, '#cdeee0'), x, .43, .265), at(ball(.022, chr), x - Math.sign(x) * .15, .55, .285)]),
      tap(chr), mirror(.66, .78, '#fffaf0'));
  },
  'vanity-pedestal'() {
    const chr = chrome();
    return group(at(cyl(.09, .14, .78, '#ffffff'), 0, .39, -.02), at(cyl(.27, .15, .16, '#ffffff'), 0, .8, 0),
      at(ring(.27, .025, '#f5f8fb'), 0, .88, 0).rotateX(Math.PI / 2), tap(chr, -.2, .86),
      at(cyl(.32, .32, .04, '#c98a55', 32), 0, 1.62, -.22).rotateX(Math.PI / 2), at(cyl(.27, .27, .02, '#dff3f8', 32), 0, 1.62, -.19).rotateX(Math.PI / 2));
  },
  'vanity-wood'() {
    const wood = '#c98a55', dark = '#9a6a45', chr = mat('#2b2f3a', { metalness: .5, roughness: .4 });
    return group(...[-.38, .38].flatMap(x => [-.18, .18].map(z => at(cyl(.025, .02, .2, dark, 8), x, .1, z))),
      at(rbox(.9, .6, .5, .04, wood), 0, .5, 0), at(rbox(.96, .05, .56, .02, '#e9c58f'), 0, .825, 0),
      ...[.38, .62].map(y => at(rbox(.8, .2, .03, .012, '#d9a36a'), 0, y, .265)), ...[.38, .62].map(y => at(rbox(.16, .025, .03, .01, dark), 0, y, .29)),
      squash(at(ball(.19, '#ffffff'), 0, .9, .02), 1, .45, 1), tap(chr, -.18, .85), mirror(.6, .8, dark));
  },

  // ===== Bồn tắm (dọc tường sau) =====
  bathtub() {
    const body = '#fffaf0', chr = chrome();
    return group(...[[-.62, .26], [.62, .26], [-.62, -.26], [.62, -.26]].flatMap(([x, z]) => [at(ball(.06, '#ffd66b'), x, .06, z), at(cyl(.035, .03, .12, '#ffd66b', 10), x, .15, z)]),
      at(rbox(1.6, .45, .75, .2, body), 0, .375, 0), ...tubRim(body), water(), tubTap(chr));
  },
  'bathtub-wood'() {
    const wood = '#d9a36a', band = '#8a5a33';
    return group(at(rbox(1.6, .6, .75, .08, wood), 0, .3, 0), at(box(1.62, .04, .77, band), 0, .15, 0), at(box(1.62, .04, .77, band), 0, .48, 0),
      ...tubRim('#c98a55'), water('#a8e0f0'), tubTap(mat('#9a6a45')),
      at(rbox(.36, .3, .3, .04, wood), 1.05, .15, .1)); // bậc gỗ bên cạnh
  },
  'bathtub-bubble'() {
    const body = '#d4e9ff', chr = chrome(), foam = '#ffffff';
    const duck = group(squash(at(ball(.07, '#ffd23f'), 0, 0, 0), 1.2, .8, 1), at(ball(.045, '#ffd23f'), .05, .06, 0), at(cone(.02, .05, '#ff8a3d', 8), .1, .06, 0).rotateZ(-Math.PI / 2));
    duck.position.set(.3, .67, .05);
    return group(...[[-.62, .26], [.62, .26], [-.62, -.26], [.62, -.26]].map(([x, z]) => at(cyl(.07, .05, .15, '#c8ccd2', 10), x, .075, z)),
      at(rbox(1.6, .45, .75, .2, body), 0, .375, 0), ...tubRim(body), water(),
      ...[[-.45, .05, .09], [-.2, -.12, .11], [.05, .12, .08], [-.6, -.1, .07], [.55, -.12, .08], [.2, -.05, .06]].map(([x, z, r]) => squash(at(ball(r, foam), x, .64, z), 1, .7, 1)),
      duck, tubTap(chr));
  },

  // ===== Buồng tắm đứng (góc sau-trái) =====
  shower() {
    const chr = chrome();
    return group(...showerTray('#f5f8fb'), at(glassPane(1.08, 1.9, .02), 0, 1.03, .53), at(glassPane(.02, 1.9, 1.08), .53, 1.03, 0),
      at(cyl(.012, .012, 1.08, chr, 8), 0, 1.98, .53).rotateZ(Math.PI / 2), at(cyl(.012, .012, 1.08, chr, 8), .53, 1.98, 0).rotateX(Math.PI / 2),
      at(cyl(.014, .014, 1.9, chr, 8), .53, 1.03, .53), ...showerHead(chr));
  },
  'shower-rain'() {
    const black = mat('#2b2f3a', { metalness: .4, roughness: .5 }), chr = chrome();
    const frame = [at(box(1.1, .03, .03, black), 0, 1.98, .53), at(box(.03, .03, 1.1, black), .53, 1.98, 0), at(box(.03, 1.9, .03, black), .53, 1.03, .53),
      at(box(.03, 1.9, .03, black), -.53, 1.03, .53), at(box(.03, 1.9, .03, black), .53, 1.03, -.53), at(box(.03, .03, 1.1, black), .53, .1, 0), at(box(1.1, .03, .03, black), 0, .1, .53)];
    return group(...showerTray('#5c6068'), at(glassPane(1.06, 1.86, .02), 0, 1.03, .53), at(glassPane(.02, 1.86, 1.06), .53, 1.03, 0), ...frame,
      ...showerHead(chr, 2.05, true), at(rbox(.3, .06, .14, .03, '#e9c58f'), -.35, .5, -.47)); // kệ gỗ nhỏ trên tường trong buồng tắm
  },
  'shower-curtain'() {
    const chr = chrome(), rodY = 2.02;
    // Rèm hai mặt (mặt trước + mặt hông) gợn sóng, mở hé một góc; vỏ mỏng hai mặt: không viền toon.
    const curtain = (w, color) => {
      const geo = new THREE.PlaneGeometry(w, 1.75, 18, 1), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) / w * Math.PI * 6) * .035);
      geo.computeVertexNormals();
      const node = mesh(geo, mat(color, { side: THREE.DoubleSide }));
      node.userData.noOutline = true;
      return node;
    };
    const front = at(curtain(.8, '#ff8fb8'), -.15, 1.1, .53), side = at(curtain(1.0, '#ff8fb8'), .53, 1.1, -.03);
    side.rotation.y = Math.PI / 2;
    return group(...showerTray('#fffaf0'), front, side,
      at(cyl(.014, .014, 1.08, chr, 8), 0, rodY, .53).rotateZ(Math.PI / 2), at(cyl(.014, .014, 1.08, chr, 8), .53, rodY, 0).rotateX(Math.PI / 2),
      ...[-.5, -.3, -.1, .1].map(x => at(ring(.025, .006, chr), x, rodY - .02, .53)), ...showerHead(chr));
  },

  // ===== Máy giặt (áp tường phải) =====
  washer() { return group(...washerBody('#f5f8fb', '#c8ccd2'), at(rbox(.3, .12, .22, .04, '#8fc9f2'), -.1, .92, -.05)); }, // rổ đồ trên nóc
  'washer-retro'() { return group(...washerBody('#ffc9d5', '#fffaf0'), at(cyl(.1, .1, .14, '#ffd66b', 16), .12, .93, 0)); },
  'washer-stack'() {
    const g = group(...washerBody('#c8ccd2', '#5c6068'), ...washerBody('#dfe3e8', '#5c6068', .86));
    return g;
  },

  // ===== Giá khăn (tường phải) =====
  towel() {
    const wood = '#c98a55';
    const g = group(...[-.42, .42].map(x => at(rbox(.05, .05, .14, .02, wood), x, 1.15, -.13)), at(cyl(.02, .02, .9, wood, 10), 0, 1.15, -.07).rotateZ(Math.PI / 2),
      at(towelCloth(.36, .6, '#ffd66b', '#ffffff'), -.2, .86, -.04), at(towelCloth(.32, .5, '#8fc9f2', '#ffffff'), .2, .91, -.04),
      ...[-.3, 0, .3].map(x => at(rbox(.04, .08, .08, .015, wood), x, 1.55, -.16)), at(towelCloth(.18, .28, '#ff8fb8', '#ffffff'), .3, 1.42, -.1));
    g.userData.wallMounted = true;
    return g;
  },
  'towel-ladder'() {
    const wood = '#d9a36a', tilt = .2;
    const ladder = group(...[-.24, .24].map(x => at(cyl(.022, .022, 1.7, wood, 8), x, .85, 0)), ...[.35, .7, 1.05, 1.4].map(y => at(cyl(.016, .016, .48, wood, 8), 0, y, 0).rotateZ(Math.PI / 2)),
      at(towelCloth(.38, .5, '#fffaf0', '#8fc9f2'), 0, .5, .03), at(towelCloth(.3, .44, '#b48ee8', '#ffffff'), 0, 1.22, .03));
    ladder.rotation.x = -tilt; // dựa lưng vào tường
    ladder.position.z = .2; // chân thang đứng trước, đỉnh tựa tường
    return group(ladder);
  },
  'towel-heated'() {
    const chr = chrome();
    const g = group(...[-.25, .25].map(x => at(cyl(.022, .022, 1.0, chr, 10), x, .85, -.12)), ...[.42, .6, .78, .96, 1.14, 1.3].map(y => at(cyl(.014, .014, .5, chr, 8), 0, y, -.12).rotateZ(Math.PI / 2)),
      ...[-.25, .25].map(x => at(rbox(.06, .06, .1, .02, chr), x, 1.28, -.2)), at(towelCloth(.4, .5, '#5c6068', '#e8617f'), 0, .95, -.08));
    g.userData.wallMounted = true;
    return g;
  },

  // ===== Khay cát của mèo =====
  litter() { return group(...tray('#f4a3b6'), at(scoop('#e8617f'), .2, .16, .05), at(rbox(.36, .02, .24, .01, '#ffd9e2'), 0, .01, .38)); },
  'litter-hood'() {
    const body = '#b48ee8';
    const dome = squash(at(mesh(new THREE.SphereGeometry(.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), body), 0, .14, 0), 1, .9, .75);
    return group(...tray(body), dome, at(cyl(.12, .12, .02, '#3a2f4a', 24), 0, .26, .245).rotateX(Math.PI / 2 - .4),
      at(ring(.12, .02, '#e6dcff'), 0, .26, .255).rotateX(-.4), at(cyl(.03, .03, .05, '#e6dcff', 12), 0, .44, 0));
  },
  'litter-cabinet'() {
    const wood = '#e9c58f', dark = '#9a6a45';
    return group(at(rbox(.8, .62, .5, .04, wood), 0, .31, 0), at(rbox(.84, .04, .54, .02, '#d9a36a'), 0, .64, 0),
      at(cyl(.13, .13, .02, '#3a2f2a', 24), -.18, .26, .255).rotateX(Math.PI / 2), at(rbox(.3, .44, .03, .012, '#f3d5a8'), .2, .31, .265),
      at(ball(.02, dark), .1, .31, .29), at(cyl(.07, .055, .1, '#e98b5a', 14), .25, .71, 0), at(ball(.09, '#6fbf4a'), .25, .82, 0));
  },

  // ===== Bồn sục lớn giữa phòng =====
  jacuzzi() {
    const shell = '#cfe9f2', chr = chrome();
    const j = group(at(cyl(.98, 1.02, .52, shell, 40), 0, .26, 0), at(ring(.93, .07, '#f5f8fb'), 0, .55, 0).rotateX(Math.PI / 2),
      at(cyl(.87, .87, .03, '#5cc8ec', 40), 0, .54, 0), ...bubbles(.86, .57),
      ...[0, 1, 2, 3].map(k => at(cyl(.035, .035, .03, chr, 12), Math.cos(k * Math.PI / 2 + .8) * .9, .6, Math.sin(k * Math.PI / 2 + .8) * .9)),
      ...step(.8, '#dfe8ee', 1.2));
    j.userData.seat = [0, .62, -.9];
    return j;
  },
  'jacuzzi-cedar'() {
    const wood = '#9a6a45', band = '#5c3d26';
    // Bồn gỗ tuyết tùng tám cạnh, đai sắt, bậc gỗ.
    const j = group(at(cyl(1.0, 1.0, .62, wood, 8), 0, .31, 0), at(cyl(1.02, 1.02, .05, band, 8), 0, .16, 0), at(cyl(1.02, 1.02, .05, band, 8), 0, .48, 0),
      at(cyl(.9, .9, .03, '#6fc6e6', 8), 0, .64, 0), ...bubbles(.88, .67),
      ...step(.8, '#b9824f', 1.22));
    j.userData.seat = [0, .66, -.9];
    return j;
  },
  'jacuzzi-mosaic'() {
    const tile = '#5fb8d8', rim = '#f5f8fb', chr = chrome();
    // Bể vuông bo góc ốp gạch mosaic (ô vuông nhỏ trên thành), tay vịn chrome hai bên bậc.
    // Thành bồn là khung 4 thanh (không phải tấm đặc) để thấy mặt nước bên trong.
    const j = group(at(rbox(1.9, .5, 1.9, .08, tile), 0, .25, 0),
      ...[-.91, .91].flatMap(s => [at(box(1.98, .07, .16, rim), 0, .535, s), at(box(.16, .07, 1.66, rim), s, .535, 0)]),
      at(rbox(1.66, .03, 1.66, .012, '#7fd6f0'), 0, .53, 0), ...bubbles(.8, .56),
      ...[-.6, -.2, .2, .6].flatMap(x => [.12, .32].map(y => at(box(.14, .14, .02, '#8fd0e8'), x, y, .96))),
      ...step(.8, '#c8e8f2', 1.22), ...[-.45, .45].map(x => at(ring(.22, .02, chr), x, .62, .95)));
    j.userData.seat = [0, .62, -.9];
    return j;
  },

  // ===== Thảm trước bồn tắm =====
  bathmat() {
    return group(at(rbox(1.1, .03, .6, .012, '#8fc9f2'), 0, .015, 0), ...[-.3, 0, .3].map(x => at(box(.1, .036, .5, '#ffffff'), x, .018, 0)));
  },
  'bathmat-fluffy'() {
    return group(squash(at(cyl(.55, .55, .04, '#fff4f6', 40), 0, .02, 0), 1, 1, .7),
      ...Array.from({ length: 12 }, (_, k) => { const a = k / 12 * Math.PI * 2; return squash(at(ball(.07, '#ffe0e6'), Math.cos(a) * .52, .03, Math.sin(a) * .36), 1, .5, 1); }));
  },
  'bathmat-duck'() {
    return group(squash(at(cyl(.42, .42, .03, '#ffd66b', 36), -.12, .015, 0), 1, 1, .75), at(cyl(.2, .2, .032, '#ffd66b', 28), .38, .016, -.12),
      at(cyl(.035, .035, .036, '#3a2f2a', 12), .42, .018, -.18), squash(at(cyl(.08, .08, .034, '#ff8a3d', 3), .6, .017, -.1), 1, 1, .7));
  },
};

// ---------- Bồn sục lớn giữa phòng (đường kính ~2 m): thành bồn, mặt nước sủi bọt, bậc lên xuống phía trước ----------
// Mặt nước nằm thấp hơn mép thành (thấy được lòng bồn); bọt khí là các cầu dẹt nổi trên mặt nước.
const bubbles = (r, y, color = '#ffffff') => Array.from({ length: 9 }, (_, k) => {
  const a = k / 9 * Math.PI * 2 + (k % 2) * .3, d = r * (k % 3 === 0 ? .25 : .62);
  return squash(at(ball(.05 + (k % 3) * .015, color), Math.cos(a) * d, y, Math.sin(a) * d), 1, .55, 1);
});
const step = (w, color, z) => [at(rbox(w, .18, .32, .04, color), 0, .09, z), at(rbox(w * .8, .16, .26, .04, color), 0, .26, z - .1)];

// ---------- Trang trí cố định trên tường phòng tắm (u = trục ngang của tường, +z = mặt hướng vào phòng) ----------
//   0 = tường sau (u = x phòng), 1 = tường trước (u = -x), 2 = tường trái (u = -z), 3 = tường phải (u = z).
const onWall = color => mat(color, { transparent: true });
function curtainPanel(w, h, color) {
  const geo = new THREE.PlaneGeometry(w, h, 16, 1), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) / w * Math.PI * 4) * .03);
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { side: THREE.DoubleSide, transparent: true }));
}
function wallFrame(w, h, frameColor, art, u, y) {
  return group(at(mesh(new THREE.BoxGeometry(w, h, .05), onWall(frameColor)), u, y, .13),
    at(new THREE.Mesh(new THREE.PlaneGeometry(w - .1, h - .1), new THREE.MeshBasicMaterial({ color: art, transparent: true, userData: { nightDim: true } })), u, y, .16));
}
// Lọ dầu gội / sữa tắm trên kệ.
const bottle = (color, cap, u, y, z = .24) => [at(cyl(.035, .04, .14, onWall(color), 12), u, y + .07, z), at(cyl(.015, .02, .04, onWall(cap), 8), u, y + .16, z)];
export function decorateBathroomWall(i, wall) {
  if (i === 0) {
    // Rèm ngắn hai bên cửa sổ trên bồn tắm (đáy rèm 1.4, cao hơn vòi bồn tắm) + thanh treo.
    const u0 = BATHROOM_WINDOW_X;
    const rod = at(cyl(.02, .02, 1.9, onWall('#c8ccd2'), 12), u0, 2.5, .2); rod.rotation.z = Math.PI / 2;
    wall.add(rod, ...[-1, 1].map(s => at(ball(.04, onWall('#c8ccd2')), u0 + s * .95, 2.5, .2)));
    for (const s of [-1, 1]) wall.add(at(curtainPanel(.4, 1.0, '#d4f0ee'), u0 + s * .78, 1.95, .19), at(box(.42, .05, .08, onWall('#8fc9f2')), u0 + s * .78, 1.7, .22));
    // Kệ đồ tắm giữa buồng tắm và cửa sổ (u -1.2): lọ dầu gội, khăn cuộn, cây nhỏ.
    const u = -1.2, y = 1.55;
    wall.add(at(mesh(roundedBox(.9, .05, .24, ROUND, .015), onWall('#fffaf0')), u, y, .23),
      ...bottle('#ff8fb8', '#ffffff', u - .32, y + .025), ...bottle('#8fc9f2', '#ffffff', u - .2, y + .025), ...bottle('#bfe3a0', '#e8617f', u - .08, y + .025),
      at(cyl(.06, .06, .16, onWall('#ffd66b'), 14), u + .12, y + .105, .23).rotateZ(Math.PI / 2), at(cyl(.06, .05, .1, onWall('#e98b5a'), 12), u + .32, y + .075, .23),
      at(ball(.08, onWall('#6fbf4a')), u + .32, y + .17, .23));
  }
  if (i === 2) {
    // Tường trái (u = -z): giấy vệ sinh cạnh bồn cầu (bồn cầu ở z -1.2 -> u 1.2), tranh phía trên két nước.
    wall.add(at(box(.05, .05, .1, onWall('#c8ccd2')), 1.75, .75, .18), at(cyl(.06, .06, .11, onWall('#ffffff'), 16), 1.75, .7, .24).rotateZ(Math.PI / 2),
      wallFrame(.44, .54, '#fffaf0', '#bfe8d6', 1.2, 1.85), wallFrame(.32, .32, '#c98a55', '#ffd9c4', 2.4, 1.7));
  }
  if (i === 3) {
    // Tường phải (u = z): móc áo choàng giữa giá khăn (z -1.7) và cửa ra sân sau (z 1), tranh nhỏ phía trên máy giặt.
    wall.add(...[-.75, -.45].flatMap(u => [at(rbox(.05, .05, .1, .02, onWall('#c98a55')), u, 1.6, .18), at(ball(.03, onWall('#c98a55')), u, 1.62, .23)]),
      at(rbox(.3, .7, .05, .02, onWall('#ffffff')), -.6, 1.25, .22), wallFrame(.4, .4, '#fffaf0', '#c9e8b0', 2.5, 1.85));
  }
  if (i === 1) {
    // Tường trước, mặt trong (u = -x phòng; cửa phòng ngủ ở x .2 -> u -.2): tranh + đồng hồ nhỏ.
    wall.add(wallFrame(.6, .44, '#8fc9f2', '#fff0c2', -2.3, 1.85),
      at(mesh(new THREE.CylinderGeometry(.2, .2, .05, 28), onWall('#ffffff')), 2.2, 2.0, .13).rotateX(Math.PI / 2),
      at(mesh(new THREE.TorusGeometry(.2, .022, 8, 28), onWall('#8fc9f2')), 2.2, 2.0, .16),
      at(box(.012, .12, .01, onWall('#2b2f3a')), 2.2, 2.04, .17), at(box(.08, .012, .01, onWall('#2b2f3a')), 2.23, 2.0, .17));
  }
}

// ---------- Đồ cố định trên sàn phòng tắm: thảm chùi chân trong cửa, thùng rác cạnh bồn cầu, chậu cây góc trước-phải ----------
export function bathroomDecor() {
  const bin = group(at(cyl(.13, .11, .32, '#ffffff', 20), 0, .16, 0), at(cyl(.14, .14, .03, '#8fc9f2', 20), 0, .335, 0));
  bin.position.set(-3.62, 0, -2.3);
  const plant = group(at(cyl(.15, .11, .3, '#e9c58f', 16), 0, .15, 0), at(ball(.2, '#6fbf4a'), 0, .45, 0), at(ball(.14, '#5fae46'), .1, .58, .05));
  plant.position.set(3.55, 0, 3.55);
  const doormat = group(at(rbox(.9, .03, .5, .015, '#c9955e'), 0, .015, 0), at(box(.7, .04, .32, '#8fc9f2'), 0, .02, 0));
  doormat.position.set(BATHROOM_DOOR.x, 0, HALF - .55);
  doormat.traverse(node => { node.castShadow = false; node.userData.noOutline = true; });
  return mergeStatic(group(doormat, bin, plant));
}

// ---------- Món thêm sau (bathshelf): mỗi chỗ chỉ có món gốc ----------
// ---------- Kệ đứng áp tường trước (rộng .92, sâu .42, nóc y 1.24): khung 2 vách + 3 tầng + tấm lưng; nóc trống cho mèo ngồi ----------
const SHELF_Y = [.08, .46, .84];
function shelfFrame(side, board, back) {
  return [...[-1, 1].map(s => at(rbox(.04, 1.2, .4, .015, side), s * .43, .6, 0)),
    ...SHELF_Y.map(y => at(rbox(.82, .04, .37, .015, board), 0, y, .015)),
    at(rbox(.92, .04, .42, .015, side), 0, 1.22, 0), // nóc
    at(rbox(.82, 1.16, .03, .012, back), 0, .62, -.185)];
}
// Khăn cuộn: trụ nằm, mặt tròn quay ra trước.
const roll = (r, len, color) => at(cyl(r, r, len, color), 0, 0, 0).rotateX(Math.PI / 2);
const rolls = (colors, x0, y) => [at(roll(.07, .26, colors[0]), x0, y + .07, 0), at(roll(.07, .26, colors[1]), x0 + .15, y + .07, 0),
  at(roll(.07, .26, colors[2]), x0 + .075, y + .2, 0)];
const shelfBottles = (colors, cap, x0, y) => colors.flatMap((c, k) => [at(cyl(.04, .045, .18, c, 12), x0 + k * .12, y + .09, 0), at(cyl(.016, .02, .04, cap, 8), x0 + k * .12, y + .2, 0)]);
const rubberDuck = (x, y, z, color = '#ffd23f') => group(squash(at(ball(.07, color), x, y + .056, z), 1.2, .8, 1), at(ball(.045, color), x + .05, y + .12, z),
  at(cone(.02, .05, '#ff8a3d', 8), x + .1, y + .12, z).rotateZ(-Math.PI / 2));
// Chậu cây nhỏ (gỗ + lá xanh) đặt trên mặt phẳng ở độ cao y.
const pottedPlant = (x, y, z, s = 1) => group(at(cyl(.05 * s, .04 * s, .08 * s, '#e9c58f', 12), x, y + .04 * s, z),
  at(ball(.065 * s, '#7fb069'), x, y + .11 * s, z), at(ball(.045 * s, '#5fae46'), x + .03 * s, y + .15 * s, z + .01 * s));
const SHELF_SEAT = [0, 1.28, .03];
Object.assign(BATHROOM_BUILD, {
  // Kệ đứng màu tươi: vách xanh, tầng vàng; khăn cuộn + giỏ cam tầng dưới, lọ dầu gội + vịt cao su tầng giữa, chậu cây + xà phòng tầng trên, đệm đỏ trên nóc.
  bathshelf() {
    const g = group(...shelfFrame('#5bb8e8', '#ffd66b', '#fffaf0'),
      ...rolls(['#ff8fb8', '#ffffff', '#b48ee8'], -.3, .1), at(rbox(.26, .18, .26, .04, '#e98b5a'), .22, .19, 0),
      ...shelfBottles(['#ff8fb8', '#8fc9f2', '#bfe3a0'], '#ffffff', -.3, .48), rubberDuck(.18, .48, 0),
      pottedPlant(-.2, .86, 0, 1.3), at(rbox(.14, .05, .09, .02, '#e8617f'), .2, .885, 0), at(rbox(.12, .05, .08, .02, '#7fc45a'), .2, .935, 0),
      at(rbox(.42, .04, .3, .015, '#e8617f'), 0, 1.26, .03));
    g.userData.seat = SHELF_SEAT;
    return g;
  },
  // Kệ thang gỗ: hai thanh đứng như thang, ba tầng gỗ, khăn vắt trên thanh ngang, giỏ mây + chai sữa tắm; nóc phẳng cho mèo nằm.
  'bathshelf-ladder'() {
    const wood = '#c98a55';
    const g = group(...[-1, 1].flatMap(s => [at(rbox(.05, 1.22, .05, .02, wood), s * .43, .61, -.15), at(rbox(.05, 1.22, .05, .02, wood), s * .43, .61, .15)]),
      ...[.12, .5, .88].map(y => at(rbox(.86, .04, .36, .015, '#e9c58f'), 0, y, 0)), at(rbox(.92, .04, .4, .015, wood), 0, 1.24, 0),
      at(cyl(.016, .016, .86, wood, 8), 0, .34, .2).rotateZ(Math.PI / 2), at(rbox(.36, .26, .03, .012, '#8fc9f2'), -.12, .23, .225), at(box(.36, .03, .034, '#ffffff'), -.12, .14, .225),
      at(rbox(.3, .16, .24, .05, '#d9a35a'), .2, .22, -.02), ...rolls(['#ffffff', '#ffd66b', '#7fc45a'], -.32, .52),
      ...shelfBottles(['#ffd66b', '#ff8fb8'], '#ffffff', .12, .52), pottedPlant(.22, .9, 0, 1.3), at(rbox(.2, .06, .14, .025, '#ffffff'), -.2, .93, 0),
      rubberDuck(-.2, .96, 0, '#ff8fb8'));
    g.userData.seat = SHELF_SEAT;
    return g;
  },
  // Kệ ô vuông trắng 2 × 3 ô, mỗi ô một giỏ vải màu (vàng, xanh, hồng), nóc đặt bình hoa nhỏ + khăn cuộn.
  'bathshelf-baskets'() {
    const ROW = [.03, .43, .83], COL = [-.29, 0, .29], colors = ['#ffd66b', '#8fc9f2', '#ff8fb8', '#bfe3a0', '#b48ee8', '#ffb347'];
    const g = group(...[-1, 1].map(s => at(rbox(.04, 1.22, .4, .015, '#fffaf0'), s * .45, .61, 0)), ...[-1, 1].map(s => at(rbox(.03, 1.18, .4, .012, '#fffaf0'), s * .145, .61, 0)),
      ...ROW.map(y => at(rbox(.88, .04, .4, .015, '#fffaf0'), 0, y + .02, 0)), at(rbox(.92, .04, .42, .015, '#fffaf0'), 0, 1.24, 0),
      at(rbox(.88, 1.2, .03, .012, '#f3e9da'), 0, .62, -.185));
    ROW.slice(0, 2).forEach((y, r) => COL.forEach((x, c) => g.add(at(rbox(.24, .26, .3, .04, colors[r * 3 + c]), x, y + .17, .02), at(rbox(.08, .03, .02, .01, '#fffaf0'), x, y + .26, .175))));
    g.add(...rolls(['#ffffff', '#8fc9f2', '#ffd66b'], -.3, .84), at(cyl(.06, .07, .2, '#8fc9f2', 14), .2, .96, 0), ...[-.03, .03].map(dx => at(ball(.05, '#ff8fb8'), .2 + dx, 1.1, 0)));
    g.userData.seat = SHELF_SEAT;
    return g;
  },
});
