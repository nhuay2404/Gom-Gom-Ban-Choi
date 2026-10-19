# Chuyển Gom Gom Rotate sang Unity

Sổ tay cho lúc port. Bản web hiện tại là **bản mẫu tham chiếu**: luật, dữ liệu, cảm giác chơi đều lấy từ đây.
Code web đã chia thư mục + file theo đúng ranh giới component Unity: mỗi file ghi ở dòng đầu "Sang Unity: …".

## 1. Bản đồ thư mục → Unity

Ba lớp. **Lõi + dữ liệu** không đụng DOM, trình duyệt hay Three.js: dịch thẳng sang C# (class thường, không MonoBehaviour),
test được bằng NUnit (Edit Mode). **Giao diện 2D** và **3D** làm lại bằng API Unity nhưng **giữ nguyên hành vi** mô tả ở dưới.

| Thư mục web | Nội dung | Sang Unity |
|---|---|---|
| `game/core/` | Luật thuần: `session` (một ván), `board-rules`, `cluster-effects`, `scoring`, `level-rules`, `board-shapes`, `adaptive`, `progression`, `boosters`, `idle`, `save`, `remote-config` | `Assets/Scripts/Core/` — namespace `GomGom.Core`, class C# thuần (+ test NUnit dịch từ `*.test.mjs`) |
| `game/data/` | `levels` (100 màn), `level-layouts` / `cat-layouts` (sinh bằng tool), `tuning`, `economy` | `ScriptableObject` hoặc JSON xuất bằng `npm run export:data` → `TextAsset` |
| `game/play/` | Màn chơi, mỗi file một component (bảng mục 2) | `Assets/Scripts/Play/` — MonoBehaviour trên scene Play |
| `game/menu/` | Menu ngoài màn chơi, mỗi file một màn hình (bảng mục 3) | `Assets/Scripts/Menu/` — MonoBehaviour / UI Toolkit |
| `game/deco/` | Cảnh 3D: `deco-room` (phòng + camera), `scenes/` (từng khu), `render/` (toon, viền, sprite), `cats/` (mèo), `map-world` (bản đồ màn 3D), `room-layout` (chỗ đặt), `deco-data` (danh mục + mua / đặt) | Scene / prefab; `room-layout` + `deco-data` là dữ liệu + luật thuần → `Core` / `ScriptableObject` |
| `game/ui/` | CSS theo hub, art SVG mèo / ô bàn (`cat-art`, `board-art`), âm thanh (`sound`) | Sprite / atlas (xuất bằng `export:art`), `AudioSource` (WAV từ `export:sounds`) |
| `game/app/` | Điểm vào: tải Remote Config (`main`, `remote-config`), nối hai luồng (`start`), ví xu + kho booster dùng chung (`shared`), onboarding, hướng dẫn Deco | Bootstrap scene + `GameServices` (singleton nhẹ) |

Quy tắc khi port: **giao diện chỉ gọi lõi rồi vẽ theo kết quả**, không tự sửa luật (như `play/` đang làm với `core/session.mjs`).
Biến dùng chung chỉ một module được gán (vd. `play/context.js setSession`); module khác chỉ đọc → sang Unity là property `private set`.

## 2. Màn chơi (`game/play/`)

| File | Việc | Component Unity |
|---|---|---|
| `play-controller.js` | Điều phối: vào màn (`startLevel` / `newGame`), đặt thẻ (`placeAt`), kết thúc lượt (`finishTurn`) | `PlayController` |
| `context.js` | Ván đang chơi (`state`, cỡ bàn W × H), skin quân, tiện ích | `PlaySession` |
| `cards.js` | Thẻ đang bóc, xoay + mũi tên gợi ý, ô Hold, thẻ kế tiếp | `CardDock` |
| `card-drag.js` | Kéo thẻ lên bàn (bóng kéo nghiêng theo tay, ô neo gần nhất, thả vào Hold, ngón thứ hai = xoay) | `CardDragController` (IBeginDrag / IDrag / IEndDrag) |
| `board-view.js` | Vẽ bàn theo hình, xem trước chỗ thả, vuốt mèo (tim, mèo bực) | `BoardView` + prefab `CellView` |
| `match-fx.js` | Anim gom, hiệu ứng cụm to, lời khen, pháo hoa, confetti | `MatchFx` (DOTween + ParticleSystem) |
| `score-bar.js` | Số "+N" bật ra rồi bay vào thanh điểm | `ScoreBar` |
| `hud.js` | `render()` chung, ô Goal (ẩn mục tiêu xong; lắc + làm sáng ô khi đủ điểm mà còn mục tiêu), sắp hết lượt | `Hud` (`Refresh()`) |
| `finale.js` | Bonus Time (xả lượt) + kết màn | `FinaleController` (coroutine) |
| `booster-bar.js` | Búa 3×3, đổi thẻ may mắn, +lượt | `BoosterBar` |
| `afk.js`, `tutorial.js`, `result.js` | Mèo ngủ khi không chạm; hướng dẫn trong màn; bảng kết quả + metric độ khó + hỏi rời màn | `AfkWatcher`, `TutorialOverlay`, `ResultPanel` + `PlayMetrics` |

## 3. Menu (`game/menu/`)

`menu-controller.js` là mặt tiền (API cho màn chơi: `showTab`, `hideMenus`, `menuOpen`, `runOnboarding`, `sceneReady`) và gọi
`startTabs / startRoom / startSettings / startDevTools` theo thứ tự cố định sau khi mọi module đã nạp — sang Unity chính là `Start()`
của từng component. Các file: `map-view` (bản đồ màn, nhận mèo thưởng) → `MapScreen`; `tabs` (thanh Home / Deco / Shop, nút Play) →
`TabBar` + `ScreenRouter`; `room` (phòng 3D dùng chung) → `RoomHost`; `deco-panel` (thẻ chỗ đặt, bảng đổi món) → `DecoPanel`;
`idle-coins` → `IdleCoinView`; `tours` (hướng dẫn Deco + onboarding) → `TourController`; `shop` → `ShopScreen`;
`areas` (chuyển khu, mở khu) → `AreaSwitcher` + `AreaUnlockPanel`; `settings` → `SettingsPanel`; `dev-tools` → không port.

## 4. Hợp đồng của `core/session.mjs`

```js
const s = createSession(levelIndex, { rng, level })   // rng có seed để test / đối chiếu; level = bản đã chỉnh độ khó (adaptive)
rotate(s)        -> { ok, error?: 'tutorial', tutorialAdvanced }
hold(s)          -> { ok, error?, swapped, tutorialAdvanced, stuck }
place(s, anchor) -> { ok, error?, result, match, effect, gained, cleaned, tutorialAdvanced, win, lose, stuck, fit }
smash(s, index)  -> { ok, error?, cells, removed, cleaned, points, win? }     // búa: đập sạch 3×3, điểm như gom
swapCard(s)      -> { ok }                                                    // đổi thẻ: LUCKY.TURNS thẻ có lợi nhất
addMoves(s, n)   -> { ok }
finaleTurn(s)    -> { ok, spawned, spawnBoard, result, match, effect, gained, extra, popped }   // xả lượt sau khi thắng
continueTutorial(s); tutorialStep(s); tutorialAllows(s, action, anchor); upcoming(s); canPlaceAnywhere(s, card); goalReached(s)
```

- `anchor` = ô góc trên-trái của hình thẻ (hàng × W + cột).
- `result.board` là bàn **sau khi đặt, trước khi gom**; `match.board` là bàn **sau khi gom**; `effect.board` (= `s.board`) là bàn
  **sau hiệu ứng cụm to**. Giao diện dùng `result` + `match.clusters` diễn anim gom, rồi `effect.effects` diễn hiệu ứng.
- Hiệu ứng (`core/cluster-effects.mjs`): cụm 4 Pounce (phá 1 lớp vật cản quanh cụm), 5 Yarn Boom (3×3), 6 Claw Cross (gom mọi mèo cùng màu + mở 1 khoá lồng gần nhất),
  7+ Call the Herd (dọn sạch cả bàn, mỗi thứ +20); cụm gom dây chuyền (mèo thoát lồng / mèo thả) cũng nổ các hiệu ứng này; gom đôi ×1.5 điểm, 3+3 Cat Drop (thả 2 mèo đơn vào chỗ có lợi nhất, thành cụm thì gom luôn). Trần điểm + hệ số ở `data/tuning.mjs` `EFFECTS`.
- Thắng khi **đủ điểm + hết lồng + hết cỏ** (`goalReached`). Xả lượt: gọi `finaleTurn` tới khi `ok = false`; còn N lượt thì bàn mọc
  "câu đố" để đúng N lượt là sạch mèo, hết lượt mà còn mèo thì chơi thêm lượt thưởng (`extra`). Sao chốt lúc thắng.
- Kết thúc ván: `s.over = true`, `s.outcome = { win, reason, stars }`.
- Thẻ: `{ offsets: [[row, col], ...], items: [{ group, name }] }`. Xoay = 90° thuận chiều rồi chuẩn hoá về gốc.

## 5. Tutorial

Bước khai ở `data/levels.mjs` (`tutorial: [...]`), luật ở `core/session.mjs`, phần vẽ ở `play/tutorial.js`:

| Bước | Người chơi phải | Giao diện hiển thị |
|---|---|---|
| `drag` | kéo thẻ vào ô `anchor` (`free: true` = đặt đâu cũng được) | khoét sáng thẻ + các ô đích, bàn tay kéo từ thẻ tới ô |
| `rotate` | chạm thẻ tới khi `offsets` khớp | khoét sáng thẻ, bàn tay nhấn |
| `hold` | kéo thẻ vào ô Hold | khoét sáng thẻ + ô Hold, bàn tay kéo |
| `tapHold` | chạm ô Hold | khoét sáng ô Hold, bàn tay nhấn |
| `info` | đọc, bấm Continue | bong bóng giữa màn, chặn chạm |

Sau bước `drag` chờ ~700 ms, các bước khác ~250 ms rồi mới hiện bước kế (để người chơi kịp thấy kết quả).

## 6. Lưu trữ (`core/save.mjs`)

Mọi key ở `SAVE_KEYS`: `progress` (sao từng màn), `deco` (xu, mèo, khu, đồ đã mua / đặt), `boosters`, `profile` (lịch sử các lần
thử cho `adaptive`), `onboarding`, `decoTour`, `sound`, `night`, `skin`. Trong Unity: một `IStorage` (PlayerPrefs hoặc file JSON)
cắm vào thay `defaultBackend()`; giữ nguyên key để đọc được save của bản web nếu cần. `deco-data.loadDeco` tự chuyển save cũ.

## 7. Xuất dữ liệu và asset

```bash
npm run export          # = export:data + export:art + export:sounds  ->  export/ (không commit, tạo lại lúc nào cũng được)
npm run export:models   # mọi model 3D (đồ Deco + mèo / chó) ra game/assets/models/models.json (glTF từng model)
```

| Lệnh | Ra | Dùng trong Unity |
|---|---|---|
| `export:data` | `export/data/*.json`: levels, cards, scoring, cats, deco, room, tuning | `TextAsset` → `JsonUtility` / ScriptableObject |
| `export:art` | `export/art/…` SVG mèo (trạng thái × giống), ô bàn | đổi PNG @2x rồi Sprite Atlas |
| `export:sounds` | `export/audio/*.wav` + `manifest.json` | `AudioClip` |
| `export:models` | glTF từng model | import glTF (glTFast), làm prefab |

Số màn trên bản đồ là **font** (bảng 10 chữ số), không phải ảnh từng màn → Unity dùng TextMeshPro. Chữ chỉ dùng 1–2 chỗ
(banner Level Complete, Failed) mới làm ảnh.

## 8. Đối chiếu sau khi port

1. `npm test` — 118 test (luật bàn, hiệu ứng cụm, session + xả lượt, 100 màn + chạy lại tutorial, tiến độ, độ khó thích ứng,
   Deco, mèo 3D, kinh tế). Dịch sang NUnit, phải qua hết.
2. `tools/levels/baseline.json` — tỉ lệ thắng của bot trên 100 màn, 400 ván / màn, seed cố định (`npm run baseline`). Bản Unity chạy
   cùng bot + cùng seed phải lệch **không quá ±2%** mỗi màn.
3. Chơi tay so với bản web: số lượt, điểm, sao, hiệu ứng cụm, booster, Bonus Time, tutorial, cảnh báo sắp hết lượt, AFK.

## 9. Cảm giác chơi cần giữ (số trong `data/tuning.mjs`)

- **Gom mèo**: mèo vừa đặt rơi → cụm bị nhấc bổng lộ bụng + chân sau đung đưa → trượt về điểm tụ và nhỏ dần; điểm nổi lên.
  State đã chốt ngay nên người chơi đặt tiếp được trong lúc anim chạy.
- **Kéo thẻ**: chạm (< 5 px) = xoay; kéo = bóng thẻ phóng to khi xa bàn, co về cỡ ô quanh bàn; thân mèo nghiêng theo vận tốc.
- **Sắp hết lượt**: ô Moves cam khi còn ≤ 30% lượt, đỏ + đập nhịp khi ≤ 3 lượt; mèo mặt buồn / lo ở 2 lượt cuối.
- **Bonus Time**: chữ + thanh điểm dải cầu vồng chạy lặp; mỗi lượt xả ~0,3 s, chạm bàn thì nhanh hơn.
- **AFK 5 giây** không chạm: mèo buồn ngủ (bàn chơi) / ngủ tại chỗ (phòng).

## 10. Phòng 3D + mèo

- Phòng 8 × 8 m (ROOM_HALF = 4), mỗi khu lệch `ZONE_OFFSET` (`deco/room-layout.mjs`). Camera phối cảnh FOV 34°; tường tự mờ khi
  camera ở phía ngoài. Đồ đặt theo `PLACES` (x, z, xoay; +z của món là mặt trước). Toon + viền: quy tắc ở `CLAUDE.md`.
- **Mèo** (`deco/cats/`): `cat-rig.mjs` = khung (root → hopper → roller (chân) → pivot → thân bo tròn, mặt dán mặt trước, 2 tai,
  đuôi nhiều đốt) → prefab; `cat-brain.mjs` = não generator, `yield` = chờ frame sau, ngắt được bất cứ lúc nào → coroutine,
  port gần nguyên; `room-cats.mjs` = cả đàn (đồ chơi từng khu, chọn hành vi theo trọng số, tương tác nhiều mèo) → `CatHerd`;
  `cat-nav.mjs` = đường đi giữa các khu qua cửa / lối → NavMesh + NavMeshLink. Mọi tư thế là lò xo tắt dần (`spring.mjs`);
  mặt theo bảng `cat-face.mjs` (8 mặt, chống nháy ≥ 0,45 s).
- Người chơi: chạm nhanh = cưng (mặt vui, tim bay); giữ 0,35 s = nhấc lên, kéo, thả.

## 11. Việc còn mở / lưu ý

- Bản web tải Three.js từ CDN; Unity không cần.
- Shop (tiền thật) mới là khung giao diện; quảng cáo là mô phỏng.
