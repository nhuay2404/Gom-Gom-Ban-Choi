# Gom Gom: bản production đầu tiên (bản đi test)

Theo dõi trực tiếp (nguồn chính, file này là bản chép): https://claude.ai/artifact/MxpWdNsqTWyf5wE2yux8Vg

## Mốc thời gian
- **21/9/2026**: tạo repo. **24/9/2026**: commit gameplay đầu tiên (Gom Gom Rotate) = ngày bắt đầu phiên bản production đầu tiên.
- Gồm **9 sprint**: 5 sprint đã xong (24/9 → 16/10, ~200 commit, ~18 ngày có commit) + 4 sprint thiết kế còn lại (22/10 → 31/10, hạn chót xong trong tháng 10).
- Phạm vi các sprint còn lại: chỉ phần thiết kế game. Setup, tối ưu, build, tích hợp SDK là việc của team kỹ thuật.

## Nội dung bản production đầu tiên
- **Gameplay**: bàn Rotate (kéo thả, xoay thẻ, Hold, gom 3), thắng theo điểm + mục tiêu (cỏ, lồng, hộp, mèo béo), 150 màn theo chương 10 màn, màn boss ở mọi màn x0 (10, 20, 30… 150), độ khó thích ứng (DDA), paywall màn 10.
- **Cơ chế / booster**: búa 3×3, đổi thẻ may mắn, +lượt, hiệu ứng cụm (Cat Drop, Claw Cross, Call the Herd, gom dây chuyền), Bonus Time.
- **Meta**: bản đồ màn 3D, Deco 3D 8 khu (vườn, phòng khách, phòng ngủ, bếp, phòng tắm, sân sau, mẫu giáo, vườn hoa), mỗi chỗ 3 món, mở khu bằng xu, xu idle.
- **Thú cưng**: 6 mèo + 6 chó (2D trên bàn, 3D trong nhà), đổi bộ quân, mèo tương tác với đồ.
- **Kinh tế + kiếm tiền**: xu, gem, Shop (gói IAP, starter pack), rewarded ads, giá booster, màn thua near-miss.
- **Giữ chân**: Daily, bộ sưu tập thú cưng, luồng người chơi quay lại, FTUE.
- **Live ops**: khung sự kiện có hạn giờ + sự kiện đầu tiên, ưu đãi có hạn giờ, push notification, mọi tham số chỉnh qua Remote Config.
- **Khác**: UI theo phương án đã chốt, âm thanh + nhạc, text VN / EN, chế độ cho người mù màu, spec analytics cho team kỹ thuật.
- Task *(có thể cắt)* có thể bỏ khỏi bản đầu nếu cần ra test sớm.

## Đã xong (dựng lại từ git log)

### Sprint 1 (24–27/9): lõi chơi Rotate
- [x] Bàn chơi Rotate: kéo thả thẻ, xoay thẻ, gom 3 (match-3)
- [x] Mèo 3D + biểu cảm riêng từng loại, anim gom / thắng
- [x] Ô Gửi tạm (Hold), xem trước thẻ tiếp theo, mũi tên gợi ý xoay
- [x] AI xếp hàng thẻ + điều kiện thắng theo điểm (120 điểm / 20 lượt)
- [ ] ~~Chạm ô để đặt thẻ (25/9: chỉ giữ kéo thả)~~ *(đã cắt)*
- [ ] ~~Xem trước 2 thẻ tiếp theo (25/9: còn 1 thẻ)~~ *(đã cắt)*
- [ ] ~~Chữ hướng dẫn trong bàn chơi (25/9)~~ *(đã cắt)*

### Sprint 2 (30/9–3/10): meta highscore Home / Deco / Shop
- [x] UI tiếng Anh, Home / Deco / Shop, phòng mèo 3D, chương 2 (màn 11–20)
- [x] Saga map, booster, đồ Deco thay thế, ngày / đêm
- [x] Độ khó thích ứng (DDA) theo profile người chơi + board shapes
- [x] Mèo thân mềm (jelly), toon shader, mèo tương tác nhiều hơn
- [x] Làm lại model Deco, nối rộng khu nhà, phòng ngủ

### Sprint 3 (5–8/10): làm lại UI + Deco, chương bếp
- [x] Sửa theo review: hỏi trước khi rời màn, Hold, thắng nhanh hơn
- [x] Deco kiểu xây chỗ, popup đổi món, Shop 2 tab
- [x] Home hub = bản đồ màn, chia stage mỗi 10 màn, vào thẳng bàn chơi
- [x] Màn có chuồng / khoá, chương 5 bếp (màn 41–50)
- [x] Cảnh ngoài nhà: bãi cỏ, con đường, SFX, chuẩn hoá biểu cảm mèo
- [ ] ~~Màn đặc biệt: tính giờ (score attack) + gom mèo kiểu Lines 98 (5/10: thử ở màn 6, 9, 13, 16 rồi bỏ)~~ *(đã cắt)*
- [ ] ~~Nút "?" hướng dẫn (5/10)~~ *(đã cắt)*
- [ ] ~~Bảng vào màn (6/10: chạm màn / Play là vào thẳng)~~ *(đã cắt)*
- [ ] ~~Home cũ (vườn 3D) (6/10: Home hub = bản đồ màn)~~ *(đã cắt)*

### Sprint 4 (9–14/10): công cụ, kinh tế, mở rộng khu
- [x] Level editor + UI Studio
- [x] Kinh tế mới: xu thưởng tăng dần, mở khu bằng xu, xu idle (+ editor Kinh tế)
- [x] Khu mới: phòng tắm, sân sau, trường mẫu giáo
- [x] Paywall màn 10, chỉnh màn boss 40 / 60 / 70
- [x] 6 chó (2D + 3D), đổi bộ quân mèo / chó, Remote Config qua REST
- [ ] ~~Hệ số nhân xu màn boss (13/10)~~ *(đã cắt)*
- [ ] ~~Theme Hồng / Hiện đại + bộ đồ Deco thứ 4 (13/10: mỗi chỗ đúng 3 món)~~ *(đã cắt)*
- [ ] ~~Thanh năng lượng (14/10)~~ *(đã cắt)*
- [ ] ~~Cầu vòm qua đường ở trường mẫu giáo (14/10)~~ *(đã cắt)*

### Sprint 5 (15–16/10): cơ chế mới, 100 màn, tách code
- [x] Hiệu ứng cụm to, búa 3×3, đổi thẻ may mắn, Bonus Time, Goal nhiều mục tiêu
- [x] Mèo béo 2×2, Cat Drop, Claw Cross, Call the Herd, gom dây chuyền
- [x] Sắp xếp lại màn 32–100 + baseline bot 100 màn
- [x] Hộp cardboard / thiếc / lồng mèo theo Figma, ô cỏ
- [x] Gom asset, tách code theo component (core / data / play / menu)
- [ ] ~~Bản nháp UI Deco (hotpotato17) (15/10: trả về bản cũ)~~ *(đã cắt)*
- [ ] ~~Hoạ văn sọc chéo trên ô cỏ (15/10)~~ *(đã cắt)*
- [ ] ~~Kitty Leap (16/10: thay bằng Cat Drop)~~ *(đã cắt)*

## Còn lại

### Sprint 6 (2 ngày, 22–23/10): lõi chơi + nhịp độ
- [ ] Chốt phương án UI: style, bố cục các màn chính (Home, Play, Result, Shop, Deco) theo Figma
- [x] Chốt thứ tự giới thiệu cơ chế màn 1–100: mỗi cơ chế có màn giới thiệu riêng + tutorial trong màn
- [ ] Rà độ khó màn 41–100 sau khi xếp lại cơ chế: đối chiếu baseline bot, đánh dấu màn vọt độ khó
- [ ] Thiết kế màn boss (40 / 60 / 70 / 100): điều gì làm màn boss khác màn thường
- [ ] Quyết định paywall màn 10 + cân DDA quanh các điểm dễ bỏ game
- [x] FTUE: 5 phút đầu, từ lúc mở game tới lần đầu vào Deco
- [ ] Cơ chế mới cho màn 70–100 nếu nội dung lặp *(có thể cắt)*
- [ ] Chế độ cho người mù màu: mỗi loại mèo / chó khác nhau đủ về hình dạng, hoạ tiết

### Sprint 7 (2 ngày, 24–25/10): kinh tế + kiếm tiền
- [ ] Kinh tế gem: nguồn, chỗ tiêu, tỉ giá với xu
- [ ] Thiết kế Shop: gói IAP, giá, starter pack (thay placeholder hiện tại)
- [ ] Chỗ đặt rewarded ads (+lượt khi thua, x2 xu, idle coin) + giới hạn mỗi ngày
- [ ] Cân lại kinh tế xu khi có gem + ads (editor Kinh tế)
- [ ] Giá booster + thời điểm gợi ý mua
- [ ] Màn thua + near-miss: cho thấy suýt thắng (thiếu bao nhiêu điểm, mục tiêu nào), mời +lượt

### Sprint 8 (3 ngày, 26–28/10): meta, giữ chân + nội dung
- [ ] Daily: quà đăng nhập, nhiệm vụ hằng ngày (nút Daily đã có trên Home)
- [ ] Bộ sưu tập thú cưng: cách nhận, giá trị, động lực sưu tầm 12 con
- [ ] Tương tác mèo ở 3 khu Deco cuối (phòng tắm, sân sau, mẫu giáo), hoặc khoá ở bản test *(có thể cắt)*
- [ ] Nhịp mở khu Deco theo tiến độ màn: kiểm khoảng thiếu phần thưởng từ màn 40 trở đi
- [ ] Định hướng âm thanh + nhạc (brief cho team audio)
- [ ] Text toàn game VN / EN: tên màn, lời khen, popup, tutorial *(có thể cắt)*
- [ ] Kế hoạch test: KPI (D1, D7, tỉ lệ qua màn 10, tỉ lệ xem ads) + câu hỏi thiết kế cần bản test trả lời
- [ ] Luồng người chơi quay lại sau 3–7 ngày: quà chào mừng, idle coin tích luỹ, nhắc lại cơ chế
- [ ] Bộ sưu tập đồ Deco: đủ bộ nhận thưởng *(có thể cắt)*
- [ ] Settings + trợ năng: rung, tốc độ animation, giảm chuyển động (code đã có reduceMotion) *(có thể cắt)*
- [ ] Đưa UI đã chốt vào game, gồm cả màn mới của Sprint 7–8 (Shop, màn thua, Daily, bộ sưu tập)

### Sprint 9 (3 ngày, 29–31/10): live ops
- [ ] Khung sự kiện có hạn giờ: loại sự kiện, thời lượng, điều kiện mở (màn tối thiểu), bật / tắt qua Remote Config
- [ ] Sự kiện đầu tiên cho bản test (ví dụ tuần lễ mèo: gom mèo để nhận đồ Deco giới hạn)
- [ ] Season pass: thang thưởng free / trả phí, nguồn điểm pass *(có thể cắt)*
- [ ] Ưu đãi có hạn giờ + điều kiện bật (thua nhiều lần, mở khu mới, quay lại sau vài ngày)
- [ ] Kịch bản push notification: nội dung + thời điểm (đầy idle coin, sự kiện sắp hết, quà Daily)
- [ ] Lịch live ops 4 tuần test + danh sách A/B test (tham số nào để trên Remote Config để đổi không cần build)
- [ ] Spec event analytics (phần thiết kế): danh sách event + funnel cần đọc sau test, giao team kỹ thuật
- [ ] Quy trình làm nội dung sau màn 100: công thức ra màn mới mỗi tuần *(có thể cắt)*
