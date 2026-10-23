# Assets — toàn bộ ảnh + âm thanh của game

Mọi file ảnh / tiếng game dùng nằm ở đây (code và CSS chỉ tham chiếu, không chứa file). Tái dùng: chép nguyên thư mục này.
Đường dẫn trong JS / HTML tính từ `game/` (`assets/img/...`); trong CSS `game/ui/<hub>/*.css` là `../../assets/img/...`.
Đổi tên / thêm file thì sửa chỗ tham chiếu ở cột "Dùng ở"; `npm run build:html` tự nhúng mọi ảnh / tiếng trong `assets/`.

| Thư mục | Nội dung | Dùng ở |
|---|---|---|
| `img/cats/` | 6 giống mèo (orange, gray, white, tuxedo, siamese, tabby): `<giống>-body.png` thân không mặt + 6 mặt `calm happy cute sleepy chew angry` (256 px, Figma) | `ui/cat-art.mjs` (bàn chơi), `deco/cats/room-cats.mjs` (mèo 3D) |
| `img/cats/fat/` | Mèo béo 2×2: `body.png` thân + mặt `face-sleep` (mặc định) / `face-annoyed` (bị gom sát bên) / `face-happy` (đủ lần đánh thức, lăn đi), 384 px | `play/board-view.js` (paintFatCat), `play/match-fx.js` (animateFat), `play/hud.js` (icon Goal) |
| `img/dogs/` | 6 giống chó (shiba, dalmatian, rottweiler, pug, golden, malamute), cùng khuôn mèo + mặt `sleep` | `ui/cat-art.mjs` (bộ chó từ màn 30) |
| `img/tutorial/` | Bàn tay hướng dẫn: `hand-tap`, `hand-drag`, cử chỉ `gesture-pinch`, `gesture-rotate` | `play/tutorial.js`, `app/deco-tour.js`, `index.html`, `tools/ads` |
| `img/farm-pop/` | Nền hồng chung, sprite trang trí (+ mask), mũi tên xoay | `ui/shared/base.css`, `ui/play/base.css` |
| `img/home/` | Pill xu / gem / năng lượng, nút daily / starter / settings / Play, icon ô vuông `icon-daily.png` / `icon-starter.png` / `icon-feedback.png` (ô dựng bằng CSS `.fh-tile`); `icon-coin.png` = đồng xu dấu chân cắt từ `pill-coins.png` (icon xu ở viên giá / bong bóng xu trong Deco, `ui/deco/deco.css`); ảnh nút cũ `btn-daily / btn-starter / btn-feedback / btn-tile.png` không còn dùng, nền trời | `ui/home/home.css`, `ui/map/map.css` |
| `img/nav/` | Thanh tab chung Home / Deco / Shop: `tabbar-frame.png` khung trống (viền nâu > đào > cam, lòng kem), `tab-active.png` viên gradient #FFDA89 -> #F4E0B6 dấu chân của tab đang chọn, `icon-home.png` / `icon-deco.png` / `icon-shop.png` icon ba tab | `ui/shared/nav.css` |
| `img/deco/` | `icon-help.png` / `icon-eye.png` icon nút hướng dẫn / ngắm nhà ở Deco (`ui/deco/deco.css`); sprite hoa 2D: `lavender.webp` oải hương 4 × 4 (hàng = tông, đậm → hồng nhạt), `hydrangea.webp` cẩm tú cầu 3 × 3 (hàng xanh / đỏ / vàng), `canopy.webp` mảng tán lá 3 × 2 | `deco/render/sprite-sheet.mjs`, dùng ở `deco/scenes/flower-garden.mjs` (vườn hoa quà), `deco/scenes/garden-expanded.mjs` (tán cây xích đu) |
| `img/map/` | Texture cỏ `grass-bg.jpg` (bản đồ 2D + ô cỏ trên bàn) | `ui/map/map.css`, `ui/play/base.css` |
| `img/play/` | HUD màn chơi: nền đồng cỏ, thanh điểm, huy hiệu Moves, khung dock / ô thẻ, booster (khung + hammer / swap / moves), khung panel Deco | `ui/play/skin.css`, `ui/deco/deco.css`, `index.html` |
| `img/board/` | Vật cản trên bàn: `crate.png` hộp cardboard (vỡ được), `tin-can.png` hộp thiếc (không vỡ), lồng `cage*.png`, 256 px, từ Figma. Ảnh vẽ AI (gốc 1254 px trong `generated-v1/`, `generated-v2/`, thu về 256 px): `mailbox.png` / `mailbox-open.png` hộp thư, `letter.png` lá thư, `vase.png` / `vase-cracked.png` bình hoa (vết nứt đã tô đậm để đọc được ở cỡ ô), `grass-sheet.png` / `syrup-sheet.png` 16 ô cỏ / siro 4 × 4 (mỗi ô 128 px, chỉ dùng phần lòng, viền + nối mảng vẽ bằng CSS) | `ui/board-art.mjs`, `ui/play/base.css` (.grass-tile, .syrup-tile), `ui/play/skin.css` (.goal-grass), `play/match-fx.js` (hộp thư mở nắp) |
| `img/result/` | Bảng kết quả thắng / thua: panel, mèo ló, sao, tim, tiêu đề, các nút | `ui/result/result.css`, `play/result.js` |
| `img/shop/` | Đồng xu, chồng xu, gói starter, nền shop (cũng là nền loading) | `ui/shop/shop.css`, `ui/shared/loading.css`, `ui/*` (icon xu), `menu/shop.js` |
| `models/models.json` | Mọi model 3D (252: đồ Deco kể cả phương án thay thế + 12 mèo / chó 3D), mỗi model một mục glTF 2.0 riêng (`models.<id>.gltf`, buffer + texture nhúng). **Không commit** (~70 MB): tạo bằng `npm run export:models` khi game đang chạy | Dùng ngoài game: lưu một mục ra `.gltf` là mở được bằng Blender / Cocos |
| `sfx/` | `bgm.mp3` nhạc nền, `cat1-8.mp3` tiếng mèo, `victory.mp3` thắng màn, `crate-break.mp3` vỡ thùng | `ui/sound.mjs` (bảng `CLIPS`, `BGM`) |

Ảnh gốc cắt từ Figma (file toàn bitmap). Model 3D trong game dựng bằng code (`game/deco/`); `models/models.json` chỉ là bản xuất để tái dùng.
