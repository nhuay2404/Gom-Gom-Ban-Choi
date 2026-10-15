// Xuất mọi model 3D của game (đồ deco gồm cả phương án thay thế + mèo / chó 3D) ra MỘT file JSON, mỗi model một mục glTF 2.0 riêng
// (buffer + texture nhúng base64) để tái dùng ngoài game (Cocos, Blender: lưu một mục ra file .gltf là mở được).
// Model dựng bằng code Three.js nên phải dựng trong trình duyệt: cần game đang chạy (npm start) + Chrome.
// Chạy: npm run export:models   ->   game/assets/models/models.json (~70 MB, không commit: .gitignore; tạo lại khi đổi model)
//   { "version": 1, "models": { "<id>": { "kind": "deco" | "pet", "name", "zone", "gltf": {...} } } }
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { launch, sleep } from '../ads/cdp.mjs';
import { GAME } from '../ads/lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'game', 'assets', 'models', 'models.json');

const b = await launch({ profile: join(tmpdir(), 'gom-gom-models-profile') });
try {
  await b.goto(GAME);
  await sleep(4000);
  const json = await b.eval(`(async () => {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const room = await import('./deco/deco-room.mjs'), cats = await import('./deco/cats/room-cats.mjs');
    const { CATALOG } = await import('./deco/deco-data.mjs'), { catGroups } = await import('./ui/cat-art.mjs');
    const exporter = new GLTFExporter(), models = {}, failed = [];
    const add = async (id, info, make) => {
      try {
        const node = make();
        // userData là móc cho code game (mèo, hiệu ứng...), có tham chiếu vòng: không xuất
        node.traverse(part => { part.userData = {}; });
        models[id] = { ...info, gltf: await exporter.parseAsync(node, { binary: false, embedImages: true, onlyVisible: true }) };
      }
      catch (error) { failed.push(id + ': ' + error.message); }
    };
    for (const id of room.modelIds()) {
      const entry = CATALOG.find(item => item.id === id);
      await add(id, { kind: 'deco', name: entry?.name ?? id, zone: entry?.zone ?? null }, () => room.buildModel(id));
    }
    // Mèo / chó 3D: ảnh mặt chỉ vẽ lên texture sau khi tải xong -> dựng một lần, chờ ảnh, rồi mới xuất.
    const pets = Object.fromEntries(catGroups.map(breed => [breed, cats.catModel(breed)]));
    await new Promise(r => setTimeout(r, 2500));
    for (const breed of catGroups) await add('pet-' + breed, { kind: 'pet', name: breed, zone: null }, () => pets[breed]);
    return JSON.stringify({ version: 1, models, failed });
  })()`);
  const data = JSON.parse(json);
  if (data.failed.length) console.warn('Không xuất được:\n  ' + data.failed.join('\n  '));
  delete data.failed;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
  console.log(`${OUT}: ${Object.keys(data.models).length} model (${(json.length / 1048576).toFixed(1)} MB)`);
} finally {
  b.proc.kill();
}
