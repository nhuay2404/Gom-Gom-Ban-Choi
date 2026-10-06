# Bàn giao phiên làm việc (2026-10-06)

Đọc `CLAUDE.md` trước (quy tắc dự án, cấu trúc thư mục, cách chia commit). File này chỉ ghi phần đang dở + bối cảnh gần nhất.
Nhánh: `gom-gom-rotate-highscore`. Chạy: `npm start` (cổng 4400; Claude desktop dùng `.claude/launch.json` với `autoPort`). Test: `npm test` (77/77 qua).

## Đã xong và đã commit (mới nhất ở trên)
- `8c23169 - Update` (người dùng commit): bản đồ màn (map-world.mjs) có LOD + bớt trang trí trùng lặp + viền mờ dần theo khoảng cách.
  - Bảng `SCATTER` (rải đồ theo vùng, trần số lượng mỗi loại, đồ to không lặp hai đoạn liền nhau).
  - Mỗi đoạn trang trí có 2 bản: gần (đủ chi tiết, viền) / xa (bỏ món `small`, không viền, lưới ít cạnh). `INK_FADE = [.42, .95]`, `LOD_FAR = 1`.
  - Mèo trên bản đồ dùng `newCatModel(breed, { coarse: true })` (lưới thô); màn thưởng "You got" dùng bản đầy đủ.
  - Số liệu: ~700–800k index/khung → ~200–300k.
- `8dc7ef1` UI: Deco có nút khoá (tròn, dưới nút Ground) ẩn mọi UI mua bán / ví / thanh tab; chỉ còn nút khoá + cài đặt mờ 50%.
- `b8c8269` UI: Home hub = bản đồ màn (thanh tab Home / Deco / Shop; ví + nút cài đặt cùng một hàng; Daily / Starter / Feedback;
  nút PLAY). Home cũ (vườn 3D) đã bỏ, khu nhà 3D chỉ còn ở Deco.
- `89cdbbb` Gameplay: bỏ bảng vào màn (chạm màn / PLAY vào thẳng bàn chơi). `?dda` ghi thông tin độ khó ra console.
- `e561d60` Deco: hiệu ứng hạt (deco-fx.mjs), khoá camera khi mở bảng đổi món, pháo giấy khi mua ở Shop.
- `65a5297` Deco: tối ưu bản đồ 3D (không dựng lại khi mở lại, dựng trang trí dần lúc rảnh, cache chất liệu...).

## ĐANG DỞ (chưa commit): camera Deco "snap" vào món bị giật
Yêu cầu người dùng: ở Deco, camera lướt tới món còn giật / lag, không mượt.

### Đã làm (trong working tree, `npm test` qua, đã gỡ hết hook debug)
`game/deco/deco-room.mjs`
- Thay 2 hoạt ảnh thời gian cố định (`glide` ease-out 750 ms + `turn` 650 ms chạy chồng nhau) bằng **một bộ lướt lò xo hai tầng
  (SmoothDamp)** cho tâm nhìn x/y/z, độ xa `r`, góc xoay ngang `th`: giữ vận tốc khi đổi đích giữa chừng, đường cong chữ S,
  không phụ thuộc FPS. API nội bộ: `glideTo(to, ms, radius)`, `turnToward(angle)`, `stopGlide()`, `stepGlide(dt)` (gọi trong `frame`).
- `stopInertia()`: xoá quán tính OrbitControls (`_sphericalDelta`, `_panOffset`, `_scale`) khi bắt đầu lướt để không giằng co.
- `clampGoal()`: đích lướt kẹp sẵn trong khung kéo (tránh clampPan kéo ngược mỗi khung → rung). `clampPan` bỏ qua khi đang lướt.
- `nudge(dy)` (trượt bù cho bảng đổi món): không dời phụt nữa mà bắt đầu một cú lướt ngắn; đang lướt thì đợi.
- Cú lướt mới đợi 1 khung (`glide.hold`) để khung nặng ngay sau cú chạm trôi qua lúc camera còn đứng yên.
- `prewarm(entries)` (export): lúc rảnh dựng sẵn (ẩn) model các món sắp xem thử + `addOutlines` + `renderer.compileAsync`.
`game/menu-controller.js`
- `renderDeco()` cập nhật thẻ **tại chỗ** (giữ phần tử + ảnh đã giải mã) thay vì dựng lại cả hàng mỗi lần chạm thẻ.
- Gọi `room3d.prewarm(...)` cho thẻ chưa khoá + `warmDecoThumbs(zone)`: chụp sẵn thumbnail các kiểu đồ / tường / sàn của khu lúc rảnh.
- `placeDecoPop`: `room3d.nudge(need)` (bù một lần, lò xo tự làm mượt) thay cho `nudge(need * .12)` mỗi khung.

### Số đo (trình duyệt test, khung mobile 375×812)
- Bản cũ: đổi món giữa chừng thì vận tốc nhảy 153% + camera quay ngược 1 lần; khung đứng hình lúc chạm thẻ lần đầu tới **383 ms**,
  mở bảng đổi món 233 ms.
- Bản mới: không còn quay ngược; khung nặng nhất lúc chạm còn ~50–100 ms (19 ms script + ~24 ms trình duyệt vẽ).
- Phát hiện cuối: ngay cả khi đứng yên / kéo tay, cảnh Deco trên máy test rớt xuống 33–50 ms ở ~25–50% số khung
  (kéo tay: 26/45 khung > 20 ms). Tức là phần giật còn lại chủ yếu do **cảnh Deco nặng về GPU** chứ không phải do thuật toán lướt.

### Việc tiếp theo đề xuất
1. Xem bằng mắt trên mobile 375×812: chạm thẻ, chạm món trong cảnh (mở bảng), đổi món giữa chừng, kéo tay lúc đang lướt.
   Chỉnh cảm giác bằng hệ số `ms / 3200` trong `startGlide` (lớn hơn = chậm hơn) và `* 1.15` cho xoay ngang trong `stepGlide`.
2. Tối ưu GPU cảnh Deco (nguyên nhân còn lại): `createRoom()` dùng `setPixelRatio(min(dpr, 2))` + `PCFSoftShadowMap` + pass viền
   (`renderOutlineIds`) mỗi khung. Thử: pixel ratio ≤ 1.5, `PCFShadowMap`, kiểm tra số lệnh vẽ / tam giác (cách đo dùng ở bản đồ:
   bọc `WebGL2RenderingContext.prototype.drawElements` đếm theo `canvas.className === 'room-canvas'`).
3. Chạy QC theo CLAUDE.md (`/?qc` phải "all clear ✓") — món dựng sẵn bởi `prewarm` ở trạng thái ẩn, cần chắc QC / mèo không coi
   chúng là vật cản (room-cats kiểm `visible`, đã xem).
4. Commit: `Deco: camera lướt bằng lò xo, dựng sẵn món + thumbnail lúc rảnh, thẻ Deco cập nhật tại chỗ`
   (chạm `game/deco/` + `menu-controller.js` → tiền tố `Deco:` theo CLAUDE.md).

## Lưu ý môi trường
- Có thể có phiên Claude khác đang chạy dev server cổng 4400 trong cùng thư mục; preview của phiên mới tự nhận cổng khác (autoPort).
- Save trong trình duyệt theo origin: test ở cổng khác 4400 không đụng save thật của người dùng.
- `git` mỗi lần commit báo `failed to delete '.git/worktrees/rh': Permission denied` — thư mục worktree cũ bị khoá, vô hại.
