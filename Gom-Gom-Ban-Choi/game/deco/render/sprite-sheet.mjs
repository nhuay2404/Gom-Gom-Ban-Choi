// Hình 2D thay khối 3D cho thứ lặp dày (bông, chùm hoa, tán lá): tấm sprite (lưới cols × rows ô, ảnh trong game/assets/img/deco/)
// dựng thành các tấm đứng chữ thập, cả loại gộp một lưới, một lệnh vẽ. Giữ phần khung 3D (gò lá, lõi tán, thân cây) để ra dáng.
// Pháp tuyến mọi tấm hướng lên: nhận sáng / bóng / ambient y như nền cỏ, không lộ tấm phẳng khi xoay camera.
// Bóng đổ theo hình ảnh (customDepthMaterial cắt alpha), không ra ô vuông.
import * as THREE from 'three';
import { TOON, toonMat } from './toon.mjs';

const textures = {};
export function spriteSheet(src, cols, rows, name) {
  const pos = [], uv = [], index = [];
  // Tấm rộng w cao h, đáy giữa ở (x, y, z), mặt phẳng theo hướng yaw; ô (col, row) tính từ góc trên trái.
  const quad = (x, y, z, yaw, w, h, col, row) => {
    const cx = Math.cos(yaw) * w / 2, cz = Math.sin(yaw) * w / 2, i = pos.length / 3, e = .004;
    const u0 = col / cols + e, u1 = (col + 1) / cols - e, v0 = 1 - (row + 1) / rows + e, v1 = 1 - row / rows - e;
    pos.push(x - cx, y, z - cz, x + cx, y, z + cz, x + cx, y + h, z + cz, x - cx, y + h, z - cz);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    index.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // Khóm = 2 tấm chữ thập cùng đáy, hai ô kề nhau trong cùng hàng.
  const tuft = (x, y, z, yaw, w, h, col, row) => {
    quad(x, y, z, yaw, w, h, col, row);
    quad(x, y, z, yaw + Math.PI / 2, w, h, (col + 1) % cols, row);
  };
  const build = () => {
    let map = textures[src];
    if (!map) {
      map = textures[src] = new THREE.TextureLoader().load(src);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    const params = { map, alphaTest: .5, side: THREE.DoubleSide };
    const node = new THREE.Mesh(geo, TOON ? toonMat({ color: '#ffffff', ...params }) : new THREE.MeshPhysicalMaterial({ roughness: .9, ...params }));
    node.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: .5 });
    node.castShadow = node.receiveShadow = true;
    node.userData.noOutline = true;
    node.userData.toonOk = `sprite 2D ${name}`;
    return node;
  };
  return { quad, tuft, build };
}
