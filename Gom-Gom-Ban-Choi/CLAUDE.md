# Gom Gom Rotate — quy tắc làm việc

Web prototype chạy bằng Node (`npm start`, cổng 4400), không cài thư viện; Three.js nạp từ CDN qua importmap.
Test logic: `npm test`. Cảnh 3D (vườn — mở rộng có đồi khi thắng màn 30 / phòng khách / phòng ngủ): `game/deco-room.mjs`,
`game/garden-scene.mjs`, `game/bedroom-scene.mjs`, `game/garden2-scene.mjs` (phần vườn mở rộng); não mèo: `game/room-cats.mjs`;
chỗ đặt đồ: `game/room-layout.mjs`; danh mục: `game/deco-data.mjs`.

## Quy trình bắt buộc sau khi thêm / sửa model 3D hoặc đổi chỗ đặt đồ

1. `npm test` phải qua.
2. Chạy **QC model**: mở `http://localhost:4400/?qc` (tự chạy) hoặc Settings → "Dev: QC models". Kết quả phải là
   **"all clear ✓"** — không được để lỗi nào. QC nằm ở `game/qc.mjs`; muốn kiểm một model riêng lúc đang làm thì gọi
   `checkModel(() => node)` (trả về `issues`).
3. Xem bằng mắt trên khung mobile (375×812): Home + Deco từng khu, xoay camera vài góc, và ảnh thumbnail của món
   trong danh sách Deco. QC không thay được mắt người (vd. mắt / mũi bị chìm trong đầu thú bông).
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
  lên `SHADOW_ONLY_LAYER` (garden2-scene.mjs): không hiện, vẫn đổ bóng.

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
- Đồ trang trí cố định (livingDecor / bedroomDecor / decorateWall) cũng phải qua đủ các kiểm tra trên như đồ mua.

**Code**
- Không chèn chú thích `//` vào giữa một dòng còn câu lệnh phía sau (test `code-rules.test.mjs` bắt lỗi này) (lỗi `sideboard.rotation.y` bị biến thành chú thích
  làm tủ quay ngang xuyên tường). Chú thích đặt dòng riêng phía trên.
- `mergeStatic()` chỉ dùng cho cụm không có bộ phận nào được code khác giữ tham chiếu để cử động riêng.
- Scale của lớp ngoài cùng món đồ bị hiệu ứng nảy (pop) ghi đè, scale của `userData.leaves` bị wiggle ghi đè:
  muốn phóng to model thì scale ở một lớp group ở giữa.
- Đặt chi tiết mặt (mắt, mũi) **ngoài** bề mặt khối đầu — kiểm bằng thumbnail.

**Mèo**
- Món mèo nhảy lên phải có điểm neo trong `userData` (seat / top / steps); nhảy xuống dùng `getDown()` (tự tìm chỗ
  đáp trống, tự thôi "đi nhờ" món đồ đung đưa).
- Đi bộ (`walkTo`): lách vật cản về **phía gần**; giới hạn thời gian tính theo quãng đường (vườn mở rộng dài 16 m);
  chống kẹt: 1.2 s không tiến ≥ .25 m thì lách (`detourSpot`, không xuyên rào) / nhảy qua đồi (`hopOverHill`).
  Thử hành vi mèo ở khu rộng: cho mèo đi giữa hai đầu xa nhất (góc phần mở rộng ↔ phòng khách / phòng ngủ).
- Test mèo trong trình duyệt: giữ thức bằng `window.dispatchEvent(new PointerEvent('pointerup'))` mỗi 1.5 s (AFK 5 s
  thì mèo đi ngủ); PointerEvent tự tạo không nổi bọt nên phải phát ở `window`.
- Món có phần đung đưa / xoay mà mèo ngồi lên: `userData.ride` + lò xo kéo về góc nghỉ 0.

**Hiệu năng**
- Cầu / trụ dùng helper `ball()` / `cyl()` (số cạnh theo kích thước); nhiều khối nhỏ giống nhau dùng InstancedMesh;
  cụm trang trí tĩnh gộp bằng `mergeStatic()`.

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

## Khác
- Dev tools chỉ hiện trên localhost hoặc URL có `?dev`: Unlock all, Reset progress, QC models.
- Khi test bằng cách sửa save trong trình duyệt: sao lưu trước, trả lại sau.
