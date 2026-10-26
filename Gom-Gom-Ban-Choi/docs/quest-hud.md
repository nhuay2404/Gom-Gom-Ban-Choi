# Quest HUD — phân tích và bộ asset

## Hiện trạng

Quests mở từ Home và Deco, từ level 6; luôn có tối đa 3 quest. Năm chuỗi hiện có: vượt level, mở khu, xây chỗ mới, nhận pet và mua style. Nhận thưởng sẽ đưa chuỗi vừa hoàn thành xuống cuối hàng và lấp chỗ trống nếu còn nội dung phù hợp. Thưởng hiện chỉ có coin; không thêm gem, daily timer, tab hoặc thưởng tổng không tồn tại trong logic.

Trước thay đổi: Quests dùng `.daily-*`, khung generic, chỉ có chữ + bar + số coin. Thiếu icon để nhận diện loại quest, nhãn Claim rõ ràng, phân cấp giữa đang làm và có thể nhận, và minh họa khi hết nội dung. Toast cũ luôn nói có quest mới dù đã hết.

## Hướng thiết kế đã áp dụng

Đối chiếu `home/btn-daily.png`, `home/icon-quest.png`, `result/panel.png`, `result/btn-next.png`: nền ivory, viền cocoa bo tròn, vàng cam bóng, xanh lá cho hành động tích cực. Giữ nguyên icon quest và coin gốc. Revision 2 thay 5 icon quest, check, sparkle và rương bằng art PNG tạo qua imagegen built-in với `home/icon-quest.png` làm tham chiếu trực tiếp: khối phồng bo mềm, viền cocoa dày, bóng amber, phản sáng ivory phía trên trái. Các mặt khung và nút vẫn là SVG chỉnh sửa được.

Hierarchy: banner + icon quest → thông báo số thưởng sẵn sàng → 3 thẻ. Mỗi thẻ gồm icon loại, nhóm nhiệm vụ, mô tả, bar + số và reward. Thẻ hoàn thành có viền xanh, dấu check và nút Claim; thẻ chưa xong dùng nút Reward bị khóa. Hết nội dung hiển thị rương hoàn thành. Nội dung tiếng Anh theo game; mọi chữ tách khỏi art để có thể dịch.

## Bàn giao

Revision 4 áp dụng cùng ribbon painted vàng của HUD nhận xu thú cưng: `banner.png` với nguồn đầy đủ và prompt trong `painted/`. Header giữ tỉ lệ 3:1, dùng `contain` để không kéo méo; icon cuộn giấy được căn theo tâm ribbon. Ribbon SVG cũ lưu trong `output/quest-kit/legacy-vector/banner-v3.svg` và không đưa vào bộ bàn giao mới.

Revision 3: Pets đổi sang đúng nhận diện mèo cam trong game (`cats/orange-body.png` + `cats/orange-happy.png`): dáng vuông bo góc, tai tam giác cao, ba sọc trán, mắt cười nhắm, miệng hồng, bụng ivory và hai chân nhỏ. Giữ chất liệu bóng và viền cocoa của HUD; nguồn PNG mới thay tại `painted/icon-pets.png`. Prompt tham chiếu được cập nhật trong `painted/prompts.json`.

- `game/assets/img/quests/`: 23 asset PNG alpha; 12 thành phần surface/control có thêm SVG nguồn; 9 icon/hình/ribbon có ảnh nguồn độ phân giải cao trong `painted/`; quest/coin PNG được chép từ art sẵn có.
- `manifest.json`: tên, kích thước, nguồn và vùng gợi ý 9-slice của các surface. Các vùng slice tính theo top/right/bottom/left, đơn vị pixel của source.
- Khung `panel`; ribbon `banner`; 3 thẻ `card-active`, `card-ready`, `card-complete`.
- Nút `button-claim`, `button-pressed`, `button-disabled`, `button-secondary`; điều khiển `close`, `check`, `badge`.
- Thanh `progress-track`, `progress-fill`; `sparkle`, `empty`.
- 5 icon: `icon-level`, `icon-area`, `icon-build`, `icon-pets`, `icon-styles`; 2 icon kế thừa `icon-quest`, `icon-coin`.
- Game dùng layout/CSS co giãn cho panel, card và bar; các surface xuất riêng phục vụ handoff sang engine khác. Chúng không phải tất cả đều là ảnh nền runtime.
- `game/menu/quest-view.mjs`: renderer dùng chung game và preview. `game/ui/home/quests.css`: style riêng, không thay Daily.
- `game/quest-kit.html`: preview tương tác, gồm mixed, active, ready, empty, chữ dài; không đụng save.
- `output/quest-kit/`: ảnh kiểm tra và gói ZIP bàn giao.

## Kích thước và hành vi

Dialog rộng tối đa 470 CSS px, thu theo viewport, giới hạn chiều cao và cuộn khi cần. Màn hẹp ≤360 px giảm icon và chữ để bảo toàn vùng nút. Close ≥46px. Có Escape/focus trap từ native dialog, focus-visible, progressbar có tên và giá trị, thông báo trạng thái, reduced motion. Sau nhận thưởng focus về Close để tránh mất focus khi thẻ được thay.

Preview có nút Close minh họa không hoạt động; Close trong game hoạt động bình thường. Badge trên Home/Deco vẫn dùng cơ chế đếm quest có thể nhận hiện tại.

## Tái tạo

`node tools/export/build-quest-kit.mjs` tạo SVG, manifest và chép các PNG từ nguồn đã lưu. `node tools/export/render-quest-kit.cjs` xuất PNG, chuẩn hóa icon painted về 512×512, kiểm tra alpha và preview ở 320/390 px; cần sharp, Playwright, Edge và game server chạy tại port 4400. Thư viện có trong bundled runtime Codex và có thể cung cấp qua NODE_PATH.

Nguồn surface nằm trong generator; ảnh icon gốc nằm trong `painted/`. Tái xuất từ nguồn đã lưu không cần API ảnh, credential hay mạng. Prompt dùng cho revision icon được lưu trong `painted/prompts.json`. File ảnh không có chữ hoặc số nhúng sẵn. Các SVG icon phẳng cũ được lưu ngoài bộ bàn giao tại `output/quest-kit/legacy-vector/` để tránh dùng nhầm.
