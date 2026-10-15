# Economy Gom Gom — tổng quan và đánh giá cân bằng

Viết ngày 2026-10-12, theo số trong `game/gameplay/economy.mjs` tại thời điểm đó. Số chi tiết theo từng lô 10 màn:
`docs/economy-report.md` (`npm run economy`). Chỉnh số + mô phỏng trực quan: Level Editor → tab **💰 Kinh tế**.

---

## 1. Tiền tệ

| Tiền | Kiếm từ | Tiêu vào |
|---|---|---|
| **Xu** | Thắng màn lần đầu, xu tự sinh (idle), gói xu (IAP, chưa bán) | Đồ trang trí (decor) — chỗ tiêu duy nhất |
| **Gem** (đá quý) | Chưa có nguồn | Chưa có chỗ tiêu |
| **Booster** | Xem quảng cáo (RV), tiền cứng, phần thưởng tiến độ | Dùng trong màn |

> Lưu ý: code vẫn còn `BOOSTER_PRICE` (hammer 60 · swap 40 · moves 80 xu) và Shop vẫn bán booster bằng xu,
> trong khi thiết kế hiện tại nói booster **không** mua bằng xu. Cần chốt một trong hai.

## 2. Nguồn xu (source)

**Xu thưởng mỗi màn** (chỉ lần thắng đầu, không phụ thuộc số sao):

```
xu(màn n) = round(120 × 1.01^(n−1))      màn boss (10, 20, …) × 1.5
```

| Màn | 1 | 10 (boss) | 30 | 50 | 100 (boss) |
|---|---|---|---|---|---|
| Xu | 120 | 197 | 159 | 193 | 482 |

Tổng 100 màn: **21,526 xu**.

**Xu tự sinh (idle)**: mèo kiếm `xu màn đang chơi × 4%` mỗi giờ, tích tối đa 8 giờ, mở từ màn 10, nhận bằng bong bóng
xu trên đầu mèo ở Deco. Một lọ đầy ≈ 1/3 xu một màn.

**Gói xu (chưa bán):** 500 xu = $0.99 · 1,200 = $1.99 · 3,000 = $4.99.

## 3. Chỗ tiêu xu (sink): đồ trang trí

Giá thật = giá gốc (bảng `DECO`) × **hệ số khu**, làm tròn 10 xu.

| Khu | Hệ số giá | Món chính (giá) | Mọi đồ (gồm kiểu khác + tường/sàn) |
|---|---|---|---|
| Vườn | ×1 | 1,380 | 4,740 |
| Vườn mở rộng | ×1 | 1,620 | 3,240 |
| Phòng khách | ×1.15 | 1,840 | 8,570 |
| Phòng ngủ | ×1.3 | 1,660 | 8,200 |
| Bếp | ×1.5 | 1,750 | 9,250 |
| Phòng tắm | ×1.7 | 2,680 | 10,080 |
| **Tổng** | | **10,930** | **44,080** |

## 4. Mở khu (progression)

Vườn có sẵn. Các khu sau mở **theo thứ tự**, cần **đủ cả hai**:
1. thắng tới **màn mốc**;
2. **tiêu đủ xu cho decor** kể từ lúc khu trước mở (không trả thêm xu để mở).

| Khu | Màn mốc | Cần tiêu cho decor |
|---|---|---|
| Vườn mở rộng | 10 | 600 |
| Phòng khách | 20 | 900 |
| Phòng ngủ | 30 | 1,100 |
| Bếp | 40 | 1,200 |
| Phòng tắm | 50 | 1,300 |

Hiển thị: khu kế tiếp là mảnh đất mờ có dấu "!" trên cảnh Deco; chạm "!" mới hiện bảng điều kiện.

---

## 5. Số liệu kiểm tra

**Theo lô 10 màn** (xu kiếm được tới lúc đó ÷ tổng giá món chính đã mở):

| Hết màn | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|
| Đủ mua món chính | 96% | 93% | 91% | 95% | 99% | 94% | **116%** | **141%** | **167%** | **197%** |
| Đủ mua mọi đồ | 28% | 35% | 27% | 25% | 24% | 23% | 29% | 35% | 41% | 49% |

**Mô phỏng người chơi ảo** (40 người / kiểu, tỉ lệ thắng theo bot trong `tools/levels/baseline.json`, trung vị):

| Kiểu | Ngày hết 100 màn | Mở phòng tắm | % phải chờ tiêu xu | Xu dư cuối game | Xu từ idle |
|---|---|---|---|---|---|
| Chơi ít (6 ván/ngày) | 31 | ngày 18 | 0% | 12,568 | 8% |
| Trung bình (12 ván/ngày) | 12 | ngày 7 | 0% | 12,123 | 7% |
| Thích sưu tầm (mua mọi kiểu) | 12 | ngày 7 | 0% | 141 | 7% |
| Chơi nhiều (30 ván/ngày) | 5 | ngày 3 | 0% | 11,380 | 4% |

> Đây là mô hình giả định (bot chỉ nhìn 1 nước; từ màn 51 dùng tỉ lệ thắng trung bình của màn 41–50), dùng để
> so các bộ số với nhau, không phải dự báo số liệu thật.

---

## 6. Nhận xét: đã cân bằng chưa?

**Tóm lại: màn 1–60 cân bằng tốt; màn 60–100 mất cân bằng (thừa xu); điều kiện "tiêu xu để mở khu" hiện chưa có tác dụng.**

### Điểm tốt
- **Màn 1–60 rất sát mục tiêu**: xu luỹ kế luôn 91–99% giá món chính, tức người chơi mua được gần hết món chính
  của khu đang mở nhưng vẫn phải chơi tiếp. Đúng nhịp "chơi → trang trí → mở khu".
- **Thưởng tăng dần, màn boss nổi bật** (×1.5): người chơi cảm nhận được tiến bộ, không có cú tụt thưởng.
- **Giá khu tăng dần** (×1 → ×1.7) đi cùng nhịp với thưởng, không khu nào quá rẻ hay quá đắt so với lúc mở.
- **Idle nhỏ đúng mức** (4–8% tổng xu): là quà khi quay lại, giúp người chơi ít nhiều hơn người chơi nhiều,
  không thay thế việc chơi màn.
- **Có chiều sâu cho người thích sưu tầm**: tổng mọi đồ (44K) gấp đôi tổng xu (21.5K), nên họ luôn còn thứ để mua.

### Vấn đề

1. **Thừa xu từ màn 60 (nghiêm trọng nhất).** Sau phòng tắm không còn khu mới, nhưng thưởng vẫn tăng 1%/màn.
   Người chơi chỉ mua món chính dư khoảng **12K xu** ở màn 100 (gần 2× tổng giá món chính). Hệ quả:
   - xu mất ý nghĩa ở nửa sau game, cảm giác "thưởng" yếu dần;
   - gói xu (IAP) gần như vô giá trị với người chơi đã qua màn 60 → doanh thu từ xu sẽ thấp.

2. **Điều kiện "tiêu xu cho decor" chưa bao giờ là nút thắt.** Mô phỏng cho thấy 0% người chơi phải chờ điều kiện này:
   họ luôn đã tiêu đủ trước khi chạm màn mốc. Thực tế khu mở **chỉ theo màn mốc**; điều kiện thứ hai chỉ là
   hình thức. Nếu muốn nó tạo động lực trang trí thật, mốc tiêu phải cao hơn.

3. **Nhịp game quá nhanh trong mô phỏng.** Người chơi trung bình hết 100 màn trong 12 ngày, phòng tắm mở ngày 7.
   Một phần do bot thắng dễ (tỉ lệ thắng là cận dưới của người thật nhưng màn 51+ chưa đo), nên cần số thật để kết luận.
   Nếu số thật cũng nhanh như vậy thì nội dung decor sẽ hết rất sớm.

4. **Lô 51–60 hơi chật** (chỉ 81% giá món chính của phòng tắm trong lô): ổn vì luỹ kế vẫn 94%, nhưng người chơi
   không tiêu hết xu từ trước sẽ thấy phòng tắm đắt.

5. **Mâu thuẫn booster**: thiết kế nói booster không mua bằng xu, code vẫn bán booster bằng xu. Nếu bán bằng xu
   thì đây là chỗ tiêu thứ hai và có thể là cách giải quyết vấn đề 1.

6. **Gem chưa có nguồn / chỗ tiêu**: đang hiện trên ví nhưng chưa tham gia economy.

### Đề xuất (theo thứ tự ưu tiên)

| # | Việc | Tác dụng |
|---|---|---|
| 1 | **Thêm khu cho màn 60–100** (vd. sân thượng, hồ bơi, phòng làm việc), mỗi khu ~2,500–3,500 xu món chính | Giải quyết thừa xu đúng gốc; thêm nội dung |
| 2 | Hoặc **ngừng tăng thưởng sau màn 60** (giữ ~200 xu/màn) — một thay đổi công thức nhỏ | Giảm thừa xu nếu chưa kịp làm khu mới |
| 3 | **Nâng mốc tiêu xu** lên ~85–100% giá món chính của khu trước (vd. 1,200 / 1,400 / 1,500 / 1,500 / 1,700) | Điều kiện "trang trí để mở khu" có tác dụng thật |
| 4 | **Chốt booster**: hoặc bỏ hẳn bán bằng xu, hoặc giữ làm chỗ tiêu thứ hai cho cuối game | Bỏ mâu thuẫn thiết kế |
| 5 | **Đo tỉ lệ thắng màn 51–100** (`npm run baseline`) và lấy analytics thật (màn/ngày, lần nhận idle) | Mô phỏng sát thực tế hơn |
| 6 | Cho **gem** một vai trò (vd. đồ decor hiếm, nhân đôi idle) hoặc ẩn khỏi ví | Tránh tiền tệ "chết" |

Mỗi đề xuất có thể thử ngay trong Level Editor → tab Kinh tế: sửa số, xem thẻ tóm tắt và bảng mô phỏng đổi theo,
rồi mới lưu vào game.
