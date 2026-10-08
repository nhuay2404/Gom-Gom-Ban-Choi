# Chuyển Gom Gom Rotate sang Cocos Creator

Sổ tay cho lúc port. Bản web hiện tại là **bản mẫu tham chiếu**: luật, dữ liệu, cảm giác chơi đều lấy từ đây.
Kế hoạch tổng thể (9 giai đoạn, ước lượng, rủi ro) nằm ở artifact "Gom Gom sang Cocos".

## 1. Bản đồ module

Code chia 3 lớp. Lớp **lõi** không đụng DOM, trình duyệt hay Three.js: chép thẳng sang TypeScript (`assets/scripts/core/`),
chạy và test được bằng Node. Hai lớp còn lại làm lại bằng API Cocos, nhưng **giữ nguyên hành vi** mô tả ở dưới.

| Lớp | File | Sang Cocos |
|---|---|---|
| **Lõi (chép)** | `game/gameplay/board-rules.mjs` | Đặt thẻ, xoay, gom cụm, thùng vỡ / kim loại không vỡ |
| | `game/gameplay/scoring.mjs` | Điểm theo cỡ cụm |
| | `game/gameplay/levels.mjs` | 20 màn + bộ chia thẻ + mốc sao |
| | `game/gameplay/board-shapes.mjs` | Hình bàn (6×6 tới 8×8, `#` = ngoài bàn): khuôn tim, tam giác, kim cương...; thu về 6×6 / mở rộng cho độ khó thích ứng |
| | `game/gameplay/session.mjs` | **Một ván chơi**: bóc thẻ, xoay, Hold (mở từ màn `HOLD.UNLOCK_LEVEL` = 11), đặt, thắng/thua, tutorial, booster. Cỡ bàn ở `s.W`, `s.H` |
| | `game/gameplay/progression.mjs` | Sao, mở khoá màn, xu thưởng, tier, cơ chế trên bàn |
| | `game/gameplay/boosters.mjs` | Kho booster (búa, đổi thẻ, +3 lượt): mở từ màn 3, dùng, mua bằng xu |
| | `game/gameplay/adaptive.mjs` | **Độ khó thích ứng**: profile người chơi -> bản màn đã bật/tắt element (moves, màu, crate, wall, board); màn có tutorial giữ bản gốc |
| | `game/deco/deco-data.mjs` | Khu vườn / phòng khách, danh mục đồ, mua / đặt / gỡ |
| | `game/gameplay/save.mjs` | Lưu trữ duy nhất (đổi backend sang `sys.localStorage`) |
| | `game/gameplay/tuning.mjs` | Mọi hằng số cảm giác chơi |
| | `game/deco/room-layout.mjs` | Chỗ đặt đồ, bán kính vật cản, cửa sổ |
| | `game/ui/cat-art.mjs`, `game/ui/board-art.mjs` | Art SVG dạng chuỗi (xuất ra PNG bằng tool) |
| **Giao diện 2D (làm lại)** | `game/app/play-controller.js` (màn chơi), `game/app/menu-controller.js` (menu), `game/app/shared.js`, `index.html`, `*.css` | Prefab UI, kéo thả, tween, tutorial overlay |
| **3D (làm lại)** | `game/deco/deco-room.mjs`, `garden-scene.mjs` | Model glTF, camera xoay, tường tự mờ |
| | `game/deco/room-cats.mjs` | Não mèo (generator) + lò xo chuyển động: **~70% chép được**, khung xương làm lại thành prefab |
| **Âm thanh** | `game/ui/sound.mjs` | File WAV xuất sẵn + `AudioSource` |

Quy tắc khi port: **giao diện chỉ gọi lõi rồi vẽ theo kết quả**, không tự sửa luật (như `play-controller.js` đang làm với `session.mjs`).

## 2. Hợp đồng của `session.mjs`

```js
const s = createSession(levelIndex, { rng })   // rng có seed để test / đối chiếu
rotate(s)        -> { ok, error?: 'tutorial', tutorialAdvanced }
hold(s)          -> { ok, error?, swapped, tutorialAdvanced, stuck }
place(s, anchor) -> { ok, error?, result, match, gained, tutorialAdvanced, win, lose, stuck, fit }
continueTutorial(s)                             // bước info: bấm Tiếp tục
tutorialStep(s), tutorialAllows(s, action, anchor), upcoming(s), canPlaceAnywhere(s, card)
```

- `anchor` = ô góc trên-trái của hình thẻ (0–35, hàng × 6 + cột).
- `result.board` là bàn **sau khi đặt, trước khi gom**; `match.board` là bàn **sau khi gom** (đã là `s.board`).
  Giao diện dùng `result` + `match.clusters` để diễn anim gom (mèo nhấc bổng -> trượt về điểm tụ `mergeTarget`).
- Kết thúc ván: `s.over = true`, `s.outcome = { win, reason, stars }` (`reason`: `'Out of moves!'` / `'No room left!'`).
- Thẻ: `{ offsets: [[row, col], ...], items: [{ group, name }] }`. Xoay = 90° thuận chiều rồi chuẩn hoá về gốc.

## 3. Tutorial

Bước trong `levels.mjs` (`tutorial: [...]`), luật ở `session.mjs`, phần vẽ ở `play-controller.js`:

| Bước | Người chơi phải | Giao diện hiển thị |
|---|---|---|
| `drag` | kéo thẻ vào ô `anchor` (`free: true` = đặt đâu cũng được) | khoét sáng thẻ + các ô đích, bàn tay kéo từ thẻ tới ô |
| `rotate` | chạm thẻ tới khi `offsets` khớp | khoét sáng thẻ, bàn tay nhấn |
| `hold` | kéo thẻ vào ô Hold | khoét sáng thẻ + ô Hold, bàn tay kéo |
| `tapHold` | chạm ô Hold | khoét sáng ô Hold, bàn tay nhấn |
| `info` | đọc, bấm Continue | bong bóng giữa màn, chặn chạm |

Tiến trình hiện tại: tutorial ở màn 1–2; màn 5 (thùng gỗ) và 8 (kim loại) chỉ có bong bóng giới thiệu.
Sau bước `drag` chờ ~700 ms, các bước khác ~250 ms rồi mới hiện bước kế (để người chơi kịp thấy kết quả).

## 4. Lưu trữ (`save.mjs`)

| Key | Nội dung |
|---|---|
| `gomgom-rotate-progress-v1` | `{ stars: number[] }` — sao tốt nhất từng màn (chỉ số 0 = màn 1) |
| `gomgom-rotate-deco-v1` | `{ coins, cats[], zone, zones: { garden, living: { owned[], placed[], wall, floor } } }` |
| `gomgom-rotate-sound` | `'on'` / `'off'` |
| `gomgom-rotate-profile-v1` | `{ attempts[], streakFrom, cooldown, giftPending, warmup, lastSeen }` — lịch sử các lần thử (thắng/thua, tỉ lệ điểm, thời gian nghĩ, idle, bỏ ngang, đứng ở bảng kết quả) cho `adaptive.mjs` |
| `gomgom-rotate-boosters-v1` | `{ hammer, swap, moves }` — số booster đang có; chưa có save = `BOOSTERS.START_STOCK` mỗi loại (luật ở `session.smash/swapCard/addMoves`, kho ở `boosters.mjs`) |

Trong Cocos: `setStorageBackend(sys.localStorage)` lúc khởi động. Giữ nguyên key để đọc được save của bản web nếu cần.
`deco-data.loadDeco` tự chuyển save cũ (trước khi có vườn) và hoàn xu đồ phòng khách.

## 5. Xuất dữ liệu và asset

```bash
npm run export        # = export:data + export:art + export:sounds  ->  export/ (không commit, tạo lại lúc nào cũng được)
```

| Lệnh | Ra | Dùng trong Cocos |
|---|---|---|
| `export:data` | `export/data/*.json`: levels, cards, scoring, cats, deco, room, tuning | đọc thẳng làm JsonAsset |
| `export:art` | `export/art/cats/<giống>/<trạng thái>.svg` (10 trạng thái × 6 giống), `cats3d/<giống>/eyes-*.svg`, `board/crate.svg`, `board/metal.svg` | đổi PNG @2x (resvg / Inkscape) rồi Auto Atlas |
| `export:sounds` | `export/audio/*.wav` + `manifest.json` (volume gợi ý ≈ 0.072, lúc nào phát tiếng nào) | `AudioClip` |

Chưa có tool: **mặt mèo 3D** (bụng, mũi, miệng, má) đang vẽ bằng canvas trong `room-cats.mjs` → `faceTexture()`;
**model đồ đạc** đang dựng bằng code trong `deco-room.mjs` → `BUILD` và `garden-scene.mjs` → `GARDEN_BUILD`
(mỗi hàm là đặc tả kích thước + màu cho artist làm lại trong Blender; ảnh thumbnail Deco chụp từ chính các model này).

## 6. Đối chiếu sau khi port

1. `npm test` — 36 test (luật bàn chơi, session, 20 màn + chạy lại tutorial, tiến độ, Deco). Chuyển sang Vitest/TS, phải qua hết.
2. `tools/baseline.json` — tỉ lệ thắng của bot trên 20 màn, 400 ván/màn, seed cố định. Bản Cocos chạy cùng bot + cùng seed
   phải lệch **không quá ±2%** mỗi màn. Đổi màn thì chạy lại `npm run baseline`.
3. Chơi tay 20 màn so với bản web: số lượt, điểm, sao, tutorial, cảnh báo sắp hết lượt, AFK.

## 7. Cảm giác chơi cần giữ (số trong `tuning.mjs`)

- **Gom mèo**: mèo vừa đặt rơi (340 ms) → cụm bị nhấc bổng lộ bụng + chân sau đung đưa (560 ms, lệch nhịp 50 ms/con)
  → trượt về điểm tụ và nhỏ dần (420 ms); điểm nổi lên. State đã chốt ngay nên người chơi đặt tiếp được trong lúc anim chạy.
- **Kéo thẻ**: chạm (< 5 px) = xoay; kéo = bóng thẻ phóng to ×1.6 khi xa bàn, co về cỡ ô trong 110 px quanh bàn;
  thân mèo bị xách gáy nghiêng theo vận tốc, chân sau + đuôi là con lắc.
- **Sắp hết lượt**: ô Moves cam khi còn ≤ 30% lượt, đỏ + đập nhịp khi ≤ 3 lượt; thông báo ở 3 lượt cuối; mèo mặt buồn/lo ở 2 lượt cuối.
- **AFK 5 giây** không chạm: mọi mèo buồn ngủ (bàn chơi) / ngủ tại chỗ (phòng).
- **Bảng vào màn** theo `tier`: chill (xanh bạc hà), normal, hard (cam, trượt nảy), boss (đỏ sẫm, rung, nút Play đỏ);
  icon thùng/kim loại nếu bàn có, gắn NEW ở màn giới thiệu cơ chế.

## 8. Phòng 3D

- Phòng 8 × 8 m (ROOM_HALF = 4), tâm ở gốc. Camera phối cảnh FOV 34°, nhìn vào (0, 0.8, 0), khoảng cách 12–24 (9–18 × ROOM_HALF / 3), góc cực 0.45–1.22 rad,
  tự xoay 0.7 ở Home (dừng 2.5 s khi người chơi chạm). Home luôn mở ở góc (7.9, 7.1, 7.9).
  Khung dọc: `zoom = min(1, aspect / 1.05)` để phòng không bị cắt hai bên.
- **Tường tự mờ** (phòng khách): tường có pháp tuyến hướng vào trong `n`; camera ở `c` thì tường mờ đi khi `c · n < -3 + 0.2`.
  Hàng rào vườn thấp nên không mờ.
- Đồ đặt theo `room-layout.mjs` (`PLACES`: x, z, xoay; +z của món hướng vào giữa phòng). Chọn một món trong Deco thì camera quay về phía món đó.

## 9. Mèo trong phòng (`room-cats.mjs`)

**Khung xương** (prefab): `root` (vị trí + hướng) → `hopper` (nảy, nhún) → `roller` (lăn nghiêng; **chân gắn ở đây**)
→ `pivot` (chúi/ngửa quanh mép sau-dưới thân) → khối thân bo tròn 0.6 × 0.54 × 0.62, mặt + mắt dán mặt trước, 2 tai, đuôi 5 đốt.
Khớp chân luôn đặt đúng đáy thân ngay phía trên nó (tính từ tổng độ chúi) nên không bao giờ hở; trên sàn thì độ dài chân vừa chạm đất.

**Chuyển động**: mọi tư thế là lò xo tắt dần `[độ cứng, tỉ lệ tắt]` (`CAT_MOTION.POSE_SPRING`); hướng hiển thị bám hướng logic
bằng lò xo; bước chân theo quãng đường (sải 0.34 m đi, 0.78 m chạy); đuôi mỗi đốt một lò xo, văng ngược khi quay / nhảy;
nhảy = hạ người lấy đà → vươn người → parabol → nhún khi tiếp đất.

**Não**: mỗi con một generator, `yield` = chờ frame sau; ngắt được bất cứ lúc nào (cưng, AFK, dời đồ, bị nhấc).
Chọn hành vi theo trọng số, không lặp lại hành vi vừa làm:

| Hành vi | Trọng số | Ghi chú |
|---|---|---|
| đi dạo · ngồi nhìn quanh · liếm lông · vươn vai + ngáp · chạy loạn · ngủ gục | 3 · 1.4 · 1.2 · 0.5 · 0.35 · 0.7 | mọi khu |
| ngắm cửa sổ · lăn thảm | 0.8 · 0.6 | phòng khách (cửa sổ bị ghế che thì nhảy lên lưng ghế) |
| rình vồ bướm | 1.1 | vườn |
| dùng đồ | 0.7–1.6 tuỳ món | mỗi món một kịch bản (nệm: xoay vòng rồi cuộn ngủ; bàn: đẩy cốc rơi; ao: khều nước...) |
| cụng mũi · rượt đuổi · liếm lông nhau | 1 · 0.6 · 0.5 | cần một con khác đang rảnh |

Người chơi: chạm nhanh = cưng (mặt vui, nảy 2 nhịp, tim bay); giữ 0.35 s = nhấc lên, kéo, thả (mèo rơi xuống chỗ trống gần nhất).
Mèo không lồng vào nhau (cách tâm ≥ 0.64) và không lấn vào đồ (cách mép ≥ 0.27).

## 10. Việc còn mở / lưu ý

- Bản web tải Three.js 0.170 từ CDN; Cocos không cần.
- Console web có lỗi `THREE.Object3D.add: object not an instance of THREE.Object3D` vài lần mỗi lần tải trang; không ảnh hưởng gameplay,
  chưa tìm ra nguồn (không xảy ra khi dựng phòng, dựng thumbnail hay chơi màn).
- Shop (tiền thật) mới là khung giao diện.
