# Gom Gom Rotate — quy tắc làm việc

Web prototype chạy bằng Node (`npm start`, cổng 4400), không cài thư viện; Three.js nạp từ CDN qua importmap.
Test logic: `npm test`. Cảnh 3D (vườn — mở rộng có đồi khi thắng màn 10 / phòng khách / phòng ngủ / bếp): `game/deco/deco-room.mjs`,
`game/deco/garden-scene.mjs`, `game/deco/bedroom-scene.mjs`, `game/deco/kitchen-scene.mjs` (bếp, mở khi thắng màn 40, bên phải phòng khách), `game/deco/garden2-scene.mjs` (phần vườn mở rộng); não mèo: `game/deco/room-cats.mjs` (bảng biểu cảm: `game/deco/cat-face.mjs`);
chỗ đặt đồ: `game/deco/room-layout.mjs`; danh mục: `game/deco/deco-data.mjs`.
Bản đồ màn 3D (trống cỏ lăn kiểu Animal Crossing, nút màn đầu mèo trên bệ): `game/deco/map-world.mjs`; không có WebGL thì dùng bản đồ 2D trong `menu-controller.js`.

**Kinh tế** (xu thưởng mỗi màn, xu ban đầu, quà, gói xu, giá booster, giá + màn mở khoá của mọi đồ deco): chỉ sửa ở
`game/gameplay/economy.mjs` (không khai giá trong `deco-data.mjs` / `tuning.mjs`). Xem bảng theo stage: `npm run economy` (ghi `docs/economy-report.md`).
**Config từ xa (Firebase Remote Config)**: mọi hằng số trong `economy.mjs` / `tuning.mjs` khai bằng `remote('TÊN', mặc định)` và được
ghi đè bởi tham số cùng tên trên Firebase (`docs/FIREBASE.md`). `app/main.js` tải config trước rồi mới nạp game (`app/start.js`).
Thêm hằng số chỉnh được mới: cũng khai bằng `remote()`, tên không trùng.

## Cấu trúc thư mục `game/` và cách chia commit

| Thư mục | Nội dung | Tiền tố commit |
|---|---|---|
| `game/ui/<hub>/` | Thiết kế UI 2D chia theo hub, mỗi hub có CSS + ảnh `img/` riêng: `shared/` (nền chung, thanh tab, ví, settings, loading, tutorial, mèo `img/cats`), `home/`, `map/`, `shop/`, `deco/`, `play/` (màn chơi), `result/` (bảng kết quả). Gốc `ui/` còn art SVG mèo / ô bàn (`cat-art.mjs`, `board-art.mjs`) và âm thanh (`sound.mjs`). Thứ tự nạp CSS xem `index.html` (đè lên nhau, đừng đảo) | `UI:` |
| `game/gameplay/` | Luật + dữ liệu chơi, thuần logic (không đụng DOM): luật bàn, hình bàn, màn, ván chơi, điểm, độ khó thích ứng, tiến độ, booster, hằng số `tuning.mjs`, lưu trữ `save.mjs` (+ test) | `Gameplay:` |
| `game/deco/` | Cảnh 3D Deco (khu nhà) + bản đồ màn: phòng, vườn, mèo 3D, toon, QC model, chỗ đặt đồ, danh mục đồ deco (+ test) | `Deco:` |
| `game/app/play-controller.js` | Luồng điều khiển **màn chơi**: kéo / xoay / đặt thẻ, Hold, anim gom, booster trong ván, AFK, tutorial, bảng vào màn, kết quả, metric độ khó | `Gameplay:` (chỉ sửa hình / anim thì `UI:`) |
| `game/app/deco-tour.js` | Hướng dẫn Deco (làm mờ + khoét sáng + bong bóng); bước khai báo ở `runDecoTour()` trong menu-controller.js | `UI:` |
| `game/app/menu-controller.js` | Luồng điều khiển **menu**: Home hub (= bản đồ màn, ví, liveops), Deco (nút khoá ẩn UI) / Shop, phòng 3D, chọn khu, cài đặt, nút dev | `UI:` (đụng cảnh 3D thì `Deco:`) |
| `game/app/` | Điều khiển ứng dụng (xem 3 dòng trên) + `main.js` (điểm vào: tải config Firebase rồi nạp `start.js`), `start.js` (nối hai luồng rồi mở game), `shared.js` (ví xu, kho booster, toast), `onboarding.js` | theo phần sửa |
| `game/` (gốc) | `index.html` (khung màn hình), `code-rules.test.mjs` | theo phần sửa |
| `tools/`, `tai-lieu/`, `docs/` | Bot mô phỏng / xuất asset, tài liệu | `Tools:` / `Docs:` |

- Mỗi commit chỉ chạm một nhóm khi có thể: sửa giao diện → chỉ `game/ui/` (+ `index.html` nếu đổi khung);
  cân bằng / luật → `game/gameplay/` (+ `tools/baseline.json` nếu đổi số liệu). Trong GitHub Desktop: tick theo thư mục.
- Hai luồng không import nhau: `app/start.js` nối chúng (`play.connectMenus(menus)`, `menus.connectPlay(play)`). Màn chơi cần
  đổi màn hình thì gọi `menus.showTab / showMap / hideMenus / menuOpen`; menu cần vào màn thì gọi `play.startLevel / mapTier`.
  Thêm hàm cho bên kia gọi: `export` ở file mình và ghi vào danh sách này. Trạng thái cả hai cùng đọc / ghi (xu, booster) đặt ở `shared.js`.
- Module mới: logic thuần đặt ở `gameplay/`, thứ chỉ để vẽ / trang trí đặt ở `ui/` hoặc `deco/`. `gameplay/` không import từ `ui/` hay `deco/`
  (ngoại lệ hiện có: `session.mjs` lấy danh sách loại mèo `categories` từ `ui/cat-art.mjs`).

## Quy trình bắt buộc sau khi thêm / sửa model 3D hoặc đổi chỗ đặt đồ

1. `npm test` phải qua.
2. Chạy **QC model**: mở `http://localhost:4400/?qc` (tự chạy) hoặc Settings → "Dev: QC models". Kết quả phải là
   **"all clear ✓"** — không được để lỗi nào. QC nằm ở `game/deco/qc.mjs`; muốn kiểm một model riêng lúc đang làm thì gọi
   `checkModel(() => node)` (trả về `issues`).
3. Xem bằng mắt trên khung mobile (375×812): Deco từng khu, xoay camera vài góc, ảnh thumbnail của món
   trong danh sách Deco, và popup xem trước của món ở Shop → Decoration. QC không thay được mắt người (vd. mắt / mũi bị chìm trong đầu thú bông).
4. Nếu sửa hành vi mèo: cho mèo dùng thử món đó (lên + xuống) trước khi báo xong.

Nếu thêm một kiểu lỗi mới mà QC chưa bắt được: thêm phép kiểm tra vào `qc.mjs` và ghi quy tắc vào file này.

## Quy tắc dựng model (mỗi quy tắc đều từ một lỗi thật đã gặp)

**Hình học**
- Khối bo góc: luôn tạo qua `rbox()` / `roundedBox()` (mesh-detail.mjs), **không** `new RoundedBoxGeometry` trực tiếp.
  Bán kính bo ≤ **nửa cạnh mỏng nhất** (tấm dày 2 cm bo tối đa 1 cm). Vượt là mặt gập ngược, chớp sáng tối —
  lỗi nắp laptop dày 1.5 cm bo 1 cm. `roundedBox` tự hạ bán kính nhưng QC vẫn báo: phải sửa con số trong model.
- Tấm phẳng dán lên khối (màn hình, tranh, mặt đồng hồ, nhãn, kính cửa sổ, phím): cách mặt khối phía sau **≥ 5 mm**
  (QC báo dưới 4 mm). Sát hơn là z-fighting nhấp nháy khi xoay camera — lỗi màn hình laptop / màn hình PC.
  Các khối nhỏ đặt trước tấm phẳng (chấn song cửa sổ...) cũng phải có mặt sau cách tấm ≥ 5 mm.
- Tấm phẳng không được cắt xuyên khối khác (rèm xuyên cột giường): đặt hẳn ra ngoài khối.
- Vỏ mỏng hở (trụ `openEnded`, tấm cong hai mặt — võng, chao đèn, thùng gỗ): đặt `userData.noOutline = true` và tạo
  viền mép riêng (xuyến / ống mảnh). Viền toon kiểu inverted hull phủ một mảng tối vào lòng vỏ mỏng.
- Không dời / xoay khối theo hằng số "ước chừng" khi khối nghiêng hay quay: tính từ hình học thật
  (lỗi mèo nằm nghiêng lún đất vì nhấc cố định .2 m).

**Địa hình (đồi ở phần vườn mở rộng)**
- Độ cao mặt đất chỉ lấy từ `groundHeight(zone, x, z)` (room-layout.mjs); model đồi dựng đúng theo công thức đó.
  Món đặt trên đồi được nhấc lên theo nó (apply()), mèo đáp / đi trên đồi dùng `world.groundAt()` — không dùng y = 0.
- Đồi là vật cản khi đi bộ; mèo chỉ lên đồi bằng hành vi trèo (`climbHill` / `leaveHill`, nhảy chặng ngắn để không
  xuyên sườn lồi). Món đứng trên đồi không có bước "đi tới trước món". Mèo đi bộ bám theo mặt đất thật (chân đồi).
- Khe giữa đồi và món khác (bán kính vật cản): **≥ .8 m hoặc ≤ .1 m** (test kiểm). Khe "suýt lọt" làm mèo kẹt giữa hai
  lực đẩy — lỗi khóm hướng dương sát chân đồi. Góc khuất giữa đồi và rào: mèo không chọn làm chỗ chơi; lỡ kẹt thì nhảy qua đồi.
- Đồ trang trí rải trên đồi (cỏ, hoa, đá, lối đá) tránh chỗ đặt món trên đỉnh.
- Mặt đất cùng màu + toon phẳng thì khối nổi không thấy được: tô màu đỉnh (sáng dần lên đỉnh, tối sườn khuất nắng) và
  viền chân để đọc được hình khối.

**Vật trên cao**
- Camera nhìn từ trên cao (~12 m): vật lơ lửng cao giữa camera và mặt đất (mây...) che mất cảnh. Chỉ muốn bóng thì đặt
  lên `SHADOW_ONLY_LAYER` (garden2-scene.mjs): không hiện, vẫn đổ bóng. Nhưng KHÔNG dùng cho vật trôi / lặp vòng (lỗi cũ: bóng mây
  là mảng tối đa giác trên cỏ, nhảy hiện / mất mỗi lần mây quay vòng — đã bỏ mây).
- Không có bóng mây ở Deco: đã thử hai cách (mây đổ bóng qua shadow map nắng: mảng đa giác, nhảy hiện / mất; rồi tấm alpha tròn mềm trôi ngang vườn) và người chơi bỏ cả hai. Đừng thêm lại.
- **Viền không được giật khi kéo / xoay / pinch camera** (toon.mjs; mỗi quy tắc từ một lỗi thật, test `outline-rules` trong `code-rules.test.mjs` canh):
  1. Nét tự mảnh theo bề ngang thật của CHÍNH bộ phận trên màn hình: thuộc tính đỉnh `outlineThin` (tính theo từng mảnh liền nhau của lưới,
     mỗi bên ≤ 28%, tối thiểu 1 px). Không tính theo hộp bao cả mesh: `mergeStatic` gộp cả hàng rào thành vài mesh nên hộp bao dài cả mét,
     nan rào vẫn bị nét đè kín và chớp (lỗi cũ: bản đầu tính theo cả lưới nên hàng rào vẫn giật).
  2. Quyết định "nét trong" từ texture ID phải MƯỢT: lấy mẫu 3 × 3 pixel ID, alpha = mix(1, innerAlpha, tỉ lệ pixel là khối của mình). Texture ID
     không khử răng cưa còn màn hình thì có MSAA; quyết định cứng theo một pixel (hay "cả 5 pixel đều là mình" rồi discard) vẫn cho mép nét
     hình bậc thang, bò / nhấp nháy khi kéo, xoay, pinch (lỗi cũ: mép đất vườn, chân hàng rào).
  3. Không đưa vào viền thứ gì phụ thuộc pixel màn hình theo cách không liên tục (noise theo toạ độ pixel, ngưỡng cứng theo khoảng cách,
     bật / tắt nét đột ngột). Nét đổi bề dày thì đổi liên tục theo khoảng cách (zoom, `outlineThin`), không nhảy.
  0. Kết cấu căn phòng / khu vườn KHÔNG có viền: sàn, tường (kèm cửa sổ, tranh treo gắn trong tường), nền cỏ, hàng rào, đồi, góc vườn. Chỉ vật thể
     (đồ mua được, mèo, đồ trang trí) có viền. Cơ chế: `addOutlines` bỏ qua mọi mesh có tổ tiên mang `userData.pickSurface` hoặc `userData.structure = true`
     (toon.mjs `isStructure`). Thêm phần kết cấu mới (mảng tường / sàn / rào mới): gán một trong hai cờ đó cho nhóm gốc; đừng tự `noOutline` lẻ từng mesh.
  4. Thêm vật mỏng mới (nan, thanh, dây, tay vịn): không cần làm gì thêm nếu đi qua `addOutlines`; vật tự vẽ viền riêng thì phải theo 3 điều trên.
- Bản đồ bóng nắng chỉ vẽ lại tối đa ~30 lần / giây (`SHADOW_STEP_MS` trong deco-room.mjs, `autoUpdate` tắt): đừng bật lại autoUpdate;
  muốn bóng cập nhật ngay thì đặt `sun.shadow.needsUpdate = true`.

**Đặt trên sàn**
- Đáy món đồ chạm sàn: không lún quá 1 cm, không lơ lửng quá 5 cm. Phần chôn có chủ đích (đá viền ao, đai thùng gỗ)
  khai báo `userData.sink = <mét>`; đồ treo tường khai báo `userData.wallMounted = true`.
- Bộ phận nghiêng / xoay (nhánh cây, đuôi, chân) tính cả phần chĩa xuống: không cắm xuyên sàn.
- Đồ đứng trên thảm được nhấc lên đúng mặt thảm (`userData.top` của thảm, xem `RUG_OF` trong deco-room.mjs).
- Thảm chùi chân / mảng phẳng sát sàn: `userData.noOutline = true` (không viền).

**Chỗ đặt (room-layout.mjs PLACES) và va chạm**
- Món đồ không lấn tường (mặt trong tường ở ±ROOM_HALF), không lấn hàng rào vườn (mặt trong rào dày nhất cách khung
  `gardenBounds()` .11). Đồ vườn gốc nằm trong khung vuông (lúc chưa mở rộng), đồ phần mở rộng (`area: 'garden2'`) trong khung dài.
- Không chạm: cánh cửa ở **cả lúc mở lẫn lúc đóng**, đồ treo tường (tranh, kệ, rèm, đồng hồ, dây cờ, đèn dây, gờ cửa sổ),
  đồ trang trí cố định (tủ thấp, gối, dép...), bụi góc vườn, và món khác cùng khu (mọi phương án thay thế).
  Cánh cửa mở về phía **trống** (khai báo `swing`); lỗi cũ: cửa phòng ngủ mở đè lên tủ thấp.
- Lối 1 m trước mỗi cửa / cổng để trống cho mèo đi.
- Món to xoay chéo 45° chiếm nhiều chỗ ở góc (mái nhà mèo va võng / bụi): ưu tiên áp tường, quay mặt vào phòng.
- Đồ trang trí cố định (livingDecor / bedroomDecor / kitchenDecor / decorateWall) cũng phải qua đủ các kiểm tra trên như đồ mua.

**Mặt trước, thumbnail và popup xem trước (Shop → Decoration)**
- Mặt trước của model quay về **+z cục bộ**. Ảnh thumbnail chụp theo `THUMB_DIR` (deco-room.mjs) trong toạ độ model; popup
  xem trước (`frameItem`) soi món theo đúng hướng đó xoay theo góc đặt món trong phòng — model dựng ngược hướng thì cả
  thumbnail lẫn popup chỉ thấy mặt sau. Không tự đặt hướng camera riêng cho popup (lỗi cũ: giữ hướng camera đang có nên
  thấy mặt sau / nhìn từ dưới).
- Popup tự ẩn mọi thứ chắn giữa camera và món: tường, rào, món khác (kể cả món mà camera nằm lọt bên trong — ghế trước
  bàn đàn), đồ trang trí cố định, mèo; tâm nhìn khoá vào món (không trôi về giữa khu). Đóng popup thì hiện lại.
  Thêm loại vật mới vào cảnh (nhóm đồ cố định mới, vật trang trí mới...) thì phải nằm trong `site` / `fixedDecor` /
  `furniture` / tường của `interiors` để popup thấy và ẩn được — QC `preview` báo nếu món còn bị che.
  (Lỗi cũ: tường che máy giặt mini, ghế đè kín đàn piano, mèo đứng chắn trước món.)

**Code**
- Không chèn chú thích `//` vào giữa một dòng còn câu lệnh phía sau (test `code-rules.test.mjs` bắt lỗi này) (lỗi `sideboard.rotation.y` bị biến thành chú thích
  làm tủ quay ngang xuyên tường). Chú thích đặt dòng riêng phía trên.
- `mergeStatic()` chỉ dùng cho cụm không có bộ phận nào được code khác giữ tham chiếu để cử động riêng.
- Scale của lớp ngoài cùng món đồ bị hiệu ứng nảy (pop) ghi đè, scale của `userData.leaves` bị wiggle ghi đè:
  muốn phóng to model thì scale ở một lớp group ở giữa.
- Đặt chi tiết mặt (mắt, mũi) **ngoài** bề mặt khối đầu — kiểm bằng thumbnail.

**Đồ gắn trên tường hoà màu tường, đồ cố định trên sàn hoà màu sàn** (`game/deco/wall-theme.mjs`, test `wall-theme.test.mjs`)
- Rèm, tranh, kệ, đồng hồ, cờ, khung cửa / cửa gắn trong tường KHÔNG giữ màu mặc định khi đổi tường: `fitToWall(màu gốc, màu tường)` xoay sắc theo tường
  (đường ngắn nhất, 70%), dời độ sáng theo tường và luôn đủ tương phản (không chìm vào tường tối), tường xám thì giữ sắc gốc. Tường mặc định -> đúng màu gốc.
- Màu trong `decorate*Wall` / `wallFrame` / `curtainPanel` cứ viết như cho tường kem mặc định (`#fff1d2`): `themeWallDecor` (deco-room.mjs) nhớ màu gốc ở
  `material.userData.wallBase` rồi tính lại từ màu gốc mỗi lần đổi tường (đổi qua lại không trôi màu). Đừng tự tô màu theo tường ở từng món.
- Không tô lại: kính / trời cửa sổ (`userData.wallKeep = true`), chất liệu có texture (biển hiệu), vật phát sáng (emissive: đèn dây, neon, đèn lồng).
  Vật liệu mới của đồ treo tường mà KHÔNG muốn đổi màu (kính, gương) phải đánh `wallKeep`.
- Chất liệu `nightDim` (tranh, cờ): `themeWallDecor` cập nhật `dayColor` để chế độ đêm / chiều vẫn nhân đúng tông.
- Đồ cố định trên sàn (tủ thấp, gối, thảm chùi chân, dép, thùng rác, thảm chạy bếp: nhóm `decor` của `livingDecor` / `bedroomDecor` / `kitchenDecor`) làm y hệt với
  `fitToFloor` (màu gốc vẽ cho sàn sồi `#e4b574`, `themeFloorDecor`, khoá `userData.floorBase`). Đồ MUA được không bị tô lại (mỗi món có thiết kế màu riêng).
  Khu vườn chưa áp dụng (cây, bụi, đá, hoa là màu thiên nhiên cố định).
- Thêm kiểu tường / sàn mới (màu mới ở deco-data.mjs): test `wall-theme.test.mjs` tự kiểm đồ treo / đồ trên sàn không chìm vào bề mặt đó.

**Mèo**
- Món mèo nhảy lên phải có điểm neo trong `userData` (seat / top / steps); nhảy xuống dùng `getDown()` (tự tìm chỗ
  đáp trống, tự thôi "đi nhờ" món đồ đung đưa).
- Đi bộ (`walkTo`): lách vật cản về **phía gần**; giới hạn thời gian tính theo quãng đường (vườn mở rộng dài 16 m);
  chống kẹt: 1.2 s không tiến ≥ .25 m thì lách (`detourSpot`, không xuyên rào) / nhảy qua đồi (`hopOverHill`).
  Thử hành vi mèo ở khu rộng: cho mèo đi giữa hai đầu xa nhất (góc phần mở rộng ↔ phòng khách / phòng ngủ).
- Test mèo trong trình duyệt: giữ thức bằng `window.dispatchEvent(new PointerEvent('pointerup'))` mỗi 1.5 s (AFK 5 s
  thì mèo đi ngủ); PointerEvent tự tạo không nổi bọt nên phải phát ở `window`.
- Món có phần đung đưa / xoay mà mèo ngồi lên: `userData.ride` + lò xo kéo về góc nghỉ 0.
- Hành vi nhiều bước không giữ món đồ (đi tới bạn, bắt chước, mai phục…): gọi `this.occupy('tên')` đầu hành vi, không thì con khác
  rủ chơi (cụng mũi…) cắt ngang giữa đường (lỗi cũ). Não bắt đầu bằng `interrupt()` (không nằm trong `life()`: phản ứng đồ rơi,
  tò mò món mới, bị nhường chỗ…) phải tự `release()` trước khi `yield* this.life()`, và bọc `useFurniture` trong try/finally nhả chỗ.
- `interrupt()` chỉ chạy não mới từ frame sau: chọn nhiều con trong cùng một lần (đánh thức + con tò mò, nhiều món mới) thì tự loại
  trừ con đã giao việc, đừng dựa vào `interruptible()`.
- Hành vi đi tới chỗ bạn: tới nơi mới làm (kiểm khoảng cách sau `walkTo`, có thể hết giờ / kẹt), bạn đã thôi thì bỏ — không "ngắm chung"
  từ phòng bên. Bạn đang ngắm thì nán lại chờ (`stayUntil`).
- Tương tác nhiều mèo (stareDown / squeezeIn / joinCampfire / watchTogether / ambush / tag / copycat) và tình huống (commotion: đồ rơi,
  spreadZoomies, furnitureChanged(fresh): món mới) nằm trong room-cats.mjs; mỗi kiểu nhiều-mèo-một-món chỉ một con làm cùng lúc.

**Biểu cảm mèo 3D** (bảng nguồn duy nhất: `game/deco/cat-face.mjs`; test: `cat-face.test.mjs`)
- Mặt đổi theo **nguyên nhân**, không ngẫu nhiên. `face(eyes)` chỉ nhận 8 giá trị, mỗi giá trị = đúng một mặt Figma:
  `open` calm (trung tính) · `focus` cute (quan tâm / muốn: rình, vồ, đuổi, ngó chim) · `happy` (vui: được cưng, lăn bụng, bắt được, cọ đầu) ·
  `blink` (dễ chịu nhắm mắt: liếm lông, nhồi bột, uống nước, nằm ấm) · `half` sleepy (buồn ngủ / ngáp / choáng) · `sleep` (ngủ say) ·
  `grumble` chew (bực **nhẹ**: chê, tiếc, ướt chân, hờn, bị bế lâu) · `annoyed` angry (giận / giật mình **mạnh**: bị nhấc, xù đuôi, khè, gai đâm).
- Miệng nằm sẵn trong ảnh mặt: không truyền miệng nào khác ngoài `face('sleep', 'yawn')` (ngáp). Truyền `'chew'` / `'zig'` / `'open'`
  là vô nghĩa (test bắt).
- Thang buồn ngủ: `open` → `half` → `sleep`. `half` chỉ là bước đệm trước khi ngủ / ngáp / choáng. Nằm thư giãn không ngủ dùng `blink`,
  hết hờn / nhìn quanh dùng `open` (lỗi cũ: loaf + `half` làm mèo trông ngáp suốt).
- `annoyed` chỉ ở hành vi giận / giật mình (danh sách trong test); bực nhẹ phải là `grumble` (lỗi cũ: lá đắng, hụt mồi, ướt chân đều ra mặt giận).
- Không có cú đổi mặt ngẫu nhiên (đã bỏ "cute" ngẫu nhiên lúc rảnh). Chỉ `open` mới tự chớp; `focus` nhìn chằm chằm không chớp.
- Chống nhấp nháy: mặt vừa hiện giữ ≥ `HOLD` (.45 s) rồi mới đổi (`settleExpression`); mặt phản ứng người chơi (cưng, bế, giật mình) đổi ngay.
  Đừng viết vòng lặp đổi mặt nhanh hơn thế. Chớp mắt tự nhiên chỉ đè lên mặt calm đang hiện.
- Lò xo cử động mèo chỉ dùng `spring()` của `game/deco/spring.mjs` (tự chia bước nhỏ theo độ cứng, test `spring.test.mjs`).
  Không tự viết lại `v += a·dt; x += v·dt` với lò xo cứng: ở 30 fps / frame khựng 50 ms nó nổ tung (lỗi cũ: mí mắt k = 900 nổ tới
  1e164, mặt mèo nháy calm ↔ blink mỗi frame — "mắt giật lag"). Thêm lò xo mới thì thêm (k, zeta) vào danh sách trong test.
- Mọi cảnh dùng chung: mèo khoe ở bản đồ / màn thưởng gọi `setCatFace(rig, breed, eyes)` với cùng bảng này.
- Thêm hành vi mới: chọn mặt theo bảng trên, không tạo giá trị mới trừ khi có ảnh Figma mới; có ảnh mới thì thêm vào `FACE` + test.

**Ambient (day / dusk / night) — tông "chill"**
- Bảng màu: `LIGHTING` (deco-room.mjs: trời, nắng, đèn, cửa kính, `grass` = màu nhân lên texture nền vườn) + `MEADOW_LOOKS` (meadow-scene.mjs: bãi cỏ, cây, sương).
  Hướng: ngày dịu ấm (không xanh neon), chiều là giờ vàng đào hồng (không nâu olive), đêm xanh lam trăng (không tím đặc) + đèn vàng ấm.
- Đổi ambient phải chuyển dần (`fadeTo` / `stepFade`, `AMBIENT_FADE` 1.6 s), không đặt màu thẳng. Màu mới phụ thuộc ambient: thêm cặp
  [màu, đích] vào `fadeTo` trong `setAmbient` (cảnh phụ thì trả về cặp như `meadow.ambientTargets`). Lần đặt đầu lúc mở game áp ngay.
- Nền vườn phải nhân màu theo ambient (`grassTint`): texture cỏ rất tươi, lỗi cũ: ban đêm cỏ vườn vẫn xanh neon.
- Vệt / quầng trang trí sát đất: không dùng màu cố định trên vật liệu không nhận sáng (MeshBasic) — không đổi theo ambient nên lộ
  thành dải màu lạ (lỗi cũ: vành xanh chân đồi).
- Đồi phải liền với cỏ, không có viền ở chân: chân đồi cùng màu nhân với nền (màu đỉnh của đồi = 1 ở chân, chỉ đổi dần lên sườn) và
  texture cỏ trải theo cùng toạ độ với nền vườn (`gardenGroundUV`, room-layout.mjs). Không thêm vành / quầng quanh chân đồi (người chơi
  thấy "viền rõ quá": đã thử vành xanh, rồi quầng tối mềm — đều bỏ).
- Địa hình (nền vườn, đồi) dùng `toonMat({ smooth: true })`: sáng tối liên tục thay cho 6 nấc cứng (mặt phẳng vẫn ra đúng độ sáng nấc cũ).
  Nấc cứng trên mặt cong biến ánh đèn điểm (lửa trại, đèn) thành các vòng cung sáng tối gãy khúc trên sườn đồi (lỗi cũ). Nền và đồi phải
  cùng kiểu (cùng smooth) để chân đồi liền với cỏ. Thêm địa hình cong mới (gò, dốc) cũng dùng smooth.
- Không có hạt lơ lửng (phấn hoa / bụi nắng / đom đóm) ở bất kỳ ambient nào: đã thử và người chơi bỏ. Đừng thêm lại.
- Đèn đường (meadow-scene.mjs `buildRoad`): vệt sáng hình nón + quầng sáng trên vỉa hè / mặt đường là lớp phủ cộng sáng (additive,
  DECAL_LAYER, gộp một mesh cho tất cả đèn), màu chạy theo ambient (đen = tắt ban ngày). Không dùng SpotLight thật cho từng đèn (hàng chục đèn).

**Ánh sáng ban đêm (chế độ đêm của Deco)**
- Chỉ nguồn sáng thật mới được sáng rực ban đêm: món có PointLight bên trong (đèn, lửa trại, đèn lồng) hoặc khai `node.userData.lightSource = true`
  (màn hình, dải LED, đèn bàn, nến — khai ở danh sách trong deco-room.mjs, ngay sau `Object.assign(BUILD, ...)`). Món KHÁC mà có vật liệu
  `emissive` hoặc `MeshBasicMaterial` (không nhận sáng) thì ban đêm tối lại thành khối sáng rực như đèn — lỗi suối / diều / cờ phơi / gương / gợn nước.
- Vật liệu phẳng không nhận sáng (nước, cờ, gương, cửa vòm, gợn nước, tranh) phải có `userData: { nightDim: true }` để ban đêm tối đi cùng cảnh.
  Muốn món sáng thật thì thêm đèn hoặc khai lightSource, đừng dựa vào emissive để "trông sáng".
- QC `glow` (qc.mjs glowIssues, chạy trong checkModel) bắt lỗi này cho mọi món nội thất; deco-room.mjs dimNonSource là chốt chặn thứ hai
  lúc chạy (tắt emissive / làm tối món không phải nguồn sáng) nhưng KHÔNG thay cho việc sửa model cho đúng.

**Hiệu năng**
- Cầu / trụ dùng helper `ball()` / `cyl()` (số cạnh theo kích thước); nhiều khối nhỏ giống nhau dùng InstancedMesh;
  cụm trang trí tĩnh gộp bằng `mergeStatic()`.
- Bản đồ màn (map-world.mjs): trang trí hai bên đường khai báo trong bảng `SCATTER` (trần số lượng mỗi loại / đoạn, đồ to không
  lặp hai đoạn liền nhau); mỗi đoạn có hai bản LOD (gần: đủ chi tiết + viền; xa: bỏ món `small`, bỏ viền, lưới ít cạnh).
  Viền không tắt phụt: mờ dần theo khoảng cách (`INK_FADE`), hết viền rồi mới đổi sang bản xa (`LOD_FAR`) — tắt đột ngột thì nhìn thấy rõ.
  Mèo trên bản đồ dùng `newCatModel(breed, { coarse: true })` (lưới thô), màn thưởng dùng bản đủ chi tiết.

**Dữ liệu**
- Mỗi chỗ đặt (slot) có `PLACES` + `OBSTACLE_RADIUS`; id món là duy nhất giữa mọi khu (test kiểm).
- Thêm khu mới: `loadDeco` phải tự thêm khu mặc định cho save cũ (test kiểm). Phòng trong nhà mặc định sàn Oak miễn phí.
- Khu mới cần: ZONE_OFFSET + LINKS (cửa / cổng nối, mèo tự tìm đường qua nhiều khu), PLACES + OBSTACLE_RADIUS,
  ZONES (mốc mở), nút trong thanh chọn khu, đồ chơi của mèo (ZONE_TOYS) và hành vi cho từng món. QC tự lấy lối cửa từ LINKS.
- **Mở rộng một khu** (vd. vườn mở rộng khi thắng màn 30, `GARDEN_EXPANSION`): KHÔNG tạo khu Deco mới. Vẫn một khu, chung
  nền + chung rào (rào chữ nhật `buildFence(..., halfX)`, khung `gardenBounds(expanded)`); đồ mới thuộc khu đó với
  `area` riêng, hiện trong cùng mục shop và chỉ hiện trong cảnh khi đã mở rộng. 'garden2' chỉ còn là ô đi lại nội bộ của
  mèo (ZONE_OFFSET + LINKS `open: true`: lối thông thoáng, không có cửa). Deco: camera lùi xa hơn (`WIDE`) cho thấy trọn.
- Phần khoá ở màn game chưa có (vườn mở rộng: màn 30): xem bằng Dev: Unlock all (bật cờ `gomgom-dev-all-zones`).

**Camera / chọn khu ở Deco**
- Deco chỉ đổi khu theo cảnh (`followDrag` trong deco-room.mjs) khi chính người chơi kéo cảnh và **không** có món đang chọn.
  Camera tự lướt / zoom (focus món, glide, autoRotate, trôi quán tính) không bao giờ được đổi khu hay bỏ chọn món — lỗi cũ:
  chọn võng sát rào sau vườn, camera lướt tới gần phòng khách nên Deco nhảy sang phòng khách và tắt võng.
  Món mới đặt sát ranh giới hai khu: thử chọn món đó ở Deco trước khi báo xong.

## Khác
- UI Studio (`npm run studio`, mở `?studio`; hướng dẫn cho artist: `docs/UI-STUDIO.md`): artist sửa CSS / ảnh trong `game/ui/` và game tự cập nhật,
  hoặc chỉnh bằng bảng trong game rồi lưu thẳng vào file. Máy chủ `tools/ui-studio.mjs` (lệnh ghi chỉ nhận từ loopback), bộ đọc / sửa CSS giữ
  định dạng `tools/ui-studio-css.mjs`, bảng `game/app/ui-studio.js`. Artist có thể đã sửa `game/ui/` ngoài chat: đọc lại file trước khi sửa.
- Dev tools chỉ hiện trên localhost, URL có `?dev`, hoặc bản HTML build (`npm run build:html` bật sẵn; bản cho người chơi: `npm run build:html -- --no-dev`): Unlock all, Reset progress, QC models.
- Khi test bằng cách sửa save trong trình duyệt: sao lưu trước, trả lại sau.
