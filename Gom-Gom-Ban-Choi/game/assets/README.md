# Assets — toàn bộ ảnh + âm thanh của game

Mọi file ảnh / tiếng game dùng nằm ở đây (code và CSS chỉ tham chiếu, không chứa file). Tái dùng: chép nguyên thư mục này.
Đường dẫn trong JS / HTML tính từ `game/` (`assets/img/...`); trong CSS `game/ui/<hub>/*.css` là `../../assets/img/...`.
Đổi tên / thêm file thì sửa chỗ tham chiếu ở cột "Dùng ở"; `npm run build:html` tự nhúng mọi ảnh / tiếng trong `assets/`.

| Thư mục | Nội dung | Dùng ở |
|---|---|---|
| `img/cats/` | 6 giống mèo (orange, gray, white, tuxedo, siamese, tabby): `<giống>-body.png` thân không mặt + 6 mặt `calm happy cute sleepy chew angry` (256 px, Figma) | `ui/cat-art.mjs` (bàn chơi), `deco/cats/room-cats.mjs` (mèo 3D) |
| `img/cats/fat/` | Mèo béo 2×2: `body.png` thân + mặt `face-sleep` (mặc định) / `face-annoyed` (bị gom sát bên) / `face-happy` (đủ lần đánh thức, lăn đi), 384 px | `play/board-view.js` (paintFatCat), `play/match-fx.js` (animateFat), `play/hud.js` (icon Goal) |
| `img/dogs/` | 6 giống chó (shiba, dalmatian, rottweiler, pug, golden, malamute), cùng khuôn mèo + mặt `sleep` | `ui/cat-art.mjs` (bộ chó từ màn 30) |
| `img/tutorial/` | Bàn tay hướng dẫn: `hand-tap`, `hand-drag`, cử chỉ `gesture-pinch`, `gesture-rotate`; `house-complete.webp` = ảnh cả ngôi nhà đủ món gốc (chụp từ cảnh Deco, không mẫu giáo) ở đầu hướng dẫn Deco (`menu/tours.js`) | `play/tutorial.js`, `app/deco-tour.js`, `index.html`, `tools/ads` |
| `img/farm-pop/` | Nền hồng chung, sprite trang trí (+ mask), mũi tên xoay | `ui/shared/base.css`, `ui/play/base.css` |
| `img/home/` | Pill xu / gem / năng lượng, nút daily / starter / settings / Play, icon ô vuông `icon-daily.png` / `icon-starter.png` / `icon-feedback.png` (ô dựng bằng CSS `.fh-tile`); `icon-coin.png` = đồng xu dấu chân cắt từ `pill-coins.png` (icon xu ở viên giá / bong bóng xu trong Deco, `ui/deco/deco.css`); ảnh nút cũ `btn-daily / btn-starter / btn-feedback / btn-tile.png` không còn dùng, nền trời | `ui/home/home.css`, `ui/map/map.css` |
| `img/deco/gift-catbed-heart.jpg` | Ảnh Heart cushion đặt trong phòng khách thật (chụp sát món từ cảnh Deco, 384×384) cho ô ngày 3 quà đăng nhập | `economy.mjs` `LOGIN_CALENDAR` (`art`), `menu/login.js` |
| `img/home/icon-login.png` | Icon quà đăng nhập 7 ngày: lịch số 7 + quà xanh nơ coral, art bóng viền cocoa khớp UI Home; PNG alpha 512×512, nguồn và prompt tại `output/login7/`; SVG cũ giữ làm tham chiếu | `index.html`: nút `home-login` (`menu/login.js`) |
| `img/home/icon-quest.png` | Icon Quest: cuộn giấy kem, dấu tích xanh, sao vàng; PNG 256×256 nền trong suốt, cùng style icon Home | `index.html`: nút `home-quests` và `deco-quests`; kích thước ở `ui/home/home.css` và `ui/deco/deco.css` |
| `img/nav/` | Thanh tab chung Home / Deco / Shop: `tabbar-frame.png` khung trống (viền nâu > đào > cam, lòng kem), `tab-active.png` viên gradient #FFDA89 -> #F4E0B6 dấu chân của tab đang chọn, `icon-home.png` / `icon-deco.png` / `icon-shop.png` icon ba tab | `ui/shared/nav.css` |
| `img/deco/` | `icon-help.png` / `icon-eye.png`: nút hướng dẫn và ngắm nhà. Cây, tán lá và hoa đã trở về hình học 3D; không dùng sprite ghép lớp | `ui/deco/deco.css`; model ở `deco/scenes/` |
| `img/map/current-level-pin.png` | Ghim định vị màu xanh, PNG 256×256 nền trong suốt; nút quay về màn hiện tại trên bản đồ | `deco/map-world.mjs`, `ui/map/map.css` |
| `img/map/` | Texture cỏ `grass-bg.jpg` (bản đồ 2D + ô cỏ trên bàn) | `ui/map/map.css`, `ui/play/base.css` |
| `img/play/background-variants/` | 8 nền luân phiên mỗi 10 màn, lặp sau 80 màn: mùa xuân → hoàng hôn → mùa thu → cúc ban mai → oải hương → hướng dương → cẩm tú cầu → vườn cây trái. PNG gốc + WebP dùng trong game (~100–150 KB/nền), không có nền đêm | `ui/play-backgrounds.mjs`, `play/board-view.js`, `ui/play/skin.css`, `ui/play/hud.css`; prompt ở `GENERATION*.txt` |
| `img/play/` | HUD màn chơi: nền đồng cỏ, thanh điểm, huy hiệu Moves, khung dock / ô thẻ, booster (khung + hammer / swap / moves), khung panel Deco | `ui/play/skin.css`, `ui/deco/deco.css`, `index.html` |
| `img/board/` | Vật cản trên bàn: `crate.png` hộp cardboard (vỡ được), `tin-can.png` hộp thiếc (không vỡ), lồng `cage*.png`, 256 px, từ Figma. Ảnh vẽ AI (gốc 1254 px trong `generated-v1/`, `generated-v2/`, thu về 256 px): `mailbox.png` / `mailbox-open.png` hộp thư, `letter.png` lá thư, `vase.png` / `vase-cracked.png` bình hoa (vết nứt đã tô đậm để đọc được ở cỡ ô), `grass-sheet.png` / `syrup-sheet.png` 16 ô cỏ / siro 4 × 4 (mỗi ô 128 px, chỉ dùng phần lòng, viền + nối mảng vẽ bằng CSS) | `ui/board-art.mjs`, `ui/play/base.css` (.grass-tile, .syrup-tile), `ui/play/skin.css` (.goal-grass), `play/match-fx.js` (hộp thư mở nắp) |
| `img/result/` | Bảng kết quả thắng / thua: panel, mèo ló, sao, tim, tiêu đề, các nút | `ui/result/result.css`, `play/result.js` |
| `img/shop/` | Đồng xu, chồng xu, gói starter, nền shop (cũng là nền loading); `sakura.svg` icon hoa anh đào cho mục Japanese Garden (nền gradient chuyển màu lặp bằng CSS) | `ui/shop/shop.css`, `ui/shared/loading.css`, `ui/*` (icon xu), `menu/shop.js` |
| `models/models.json` | Mọi model 3D (252: đồ Deco kể cả phương án thay thế + 12 mèo / chó 3D), mỗi model một mục glTF 2.0 riêng (`models.<id>.gltf`, buffer + texture nhúng). **Không commit** (~70 MB): tạo bằng `npm run export:models` khi game đang chạy | Dùng ngoài game: lưu một mục ra `.gltf` là mở được bằng Blender / Cocos |
| `video/sample-ad.mp4` | Video quảng cáo mẫu (720×1280, 15 s) cho rewarded ads giả lập | `app/ads.js` (`SIM_VIDEO`) |
| `sfx/` | `bgm.mp3` nhạc nền, `cat1-8.mp3` tiếng mèo, `victory.mp3` thắng màn, `crate-break.mp3` vỡ thùng | `ui/sound.mjs` (bảng `CLIPS`, `BGM`) |

Ảnh gốc cắt từ Figma (file toàn bitmap). Model 3D trong game dựng bằng code (`game/deco/`); `models/models.json` chỉ là bản xuất để tái dùng.
# Gem pack shop illustrations

## Navigation and liveops icons (matte)

Active `nav/icon-{home,deco,shop}-matte.png` and `home/icon-{daily,login,starter,quest}-matte.png` use neutral ivory, flat original color families, light cel shading and warm-brown outlines. Original silhouettes are retained except Quests, which now uses a clipboard checklist. Used in `index.html`; the quest dialog emblem shares the same clipboard via `menu/quest-view.mjs`. Original PNGs remain as prior versions. Prompts: `output/icons-matte-generation.json`. Art direction: `docs/art-style.md`.

The 16,000 tier now uses `img/shop/gem-packs/gems_16000-modern-full.png`: three open boxes heaped with pink gems and loose gems spilling around the base. Prompt: `output/gem-pack-16000-abundant-generation.json`.

`img/shop/gem-packs/gems_{200,550,1200,2600,7000,16000}-modern.png`: active transparent shop illustrations, from simple pink gem tokens to zip pouches, paper shopping bags, delivery boxes and a storage bin with paw labels. Matte pastel everyday cat-home style. Used by `menu/shop.js`; the pack ID selects artwork independently of its configurable amount and price. Source prompts: `output/gem-packs-modern-generation.json`. Earlier unsuffixed fantasy assets are retained as the previous version.
