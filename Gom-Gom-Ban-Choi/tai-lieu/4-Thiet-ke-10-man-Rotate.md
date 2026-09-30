# Gom Gom Rotate — Thiết kế 10 màn đầu

Tài liệu này mô tả cách dựng 10 màn đầu của bản Rotate (`game/`): nguyên tắc thiết kế, nhịp từng màn, tutorial, luồng màn hình và số liệu cân bằng. Dữ liệu màn nằm ở `game/levels.mjs`; công cụ cân độ khó ở `tools/simulate-levels.mjs`.

## 1. Nguyên tắc (tham khảo khuôn phổ biến của game puzzle mobile)

1. **Một màn, một ý mới.** Mỗi màn giới thiệu nhiều nhất một cơ chế. Tên cơ chế hiện ngay trên bảng giới thiệu màn ("Mới: …").
2. **Dạy bằng tay, không bằng chữ.** Màn tutorial ép đúng nước đi: tối màn hình, khoét sáng đúng chỗ cần chạm, bàn tay chạy từ thẻ tới ô đích. Chữ chỉ là một câu ngắn trong bong bóng.
3. **Thắng chắc ở đầu.** Màn 1–4 gần như không thể thua (bộ bài kịch bản, mục tiêu thấp) để người chơi mới thấy mình giỏi trước khi gặp độ khó.
4. **Dạy → luyện → biến tấu → thử thách.** Sau mỗi cụm cơ chế có một màn nghỉ cho người chơi tự áp dụng, rồi mới tăng áp lực.
5. **Độ khó răng cưa.** Độ khó không tăng đều mà lên, thả nhẹ, rồi lên cao hơn (màn 8 là đỉnh nhỏ, màn 9 thả nhẹ, màn 10 là đỉnh chương).
6. **Thua phải thấy lý do.** Hai cách thua đều rõ ràng: *Hết lượt* hoặc *Hết chỗ đặt* (thẻ đang bóc lẫn thẻ gửi tạm đều không vừa bàn ở mọi hướng xoay).

## 2. Nhịp 10 màn

| Màn | Tên | Beat | Cơ chế mới | Lượt | Mục tiêu | Loại mèo | Ghi chú thiết kế |
|---|---|---|---|---|---|---|---|
| 1 | Chào mèo nhỏ | Dạy | Kéo thả, gom 3 | 4 | 60 | 2 | 2 nước ép: hoàn thành cặp cam rồi cặp xám. Thắng sau 2 nước. |
| 2 | Xoay xoay | Dạy | Xoay thẻ | 5 | 60 | 3 | Khe dọc 2 ô, thẻ đôi nằm ngang không lọt. Nước 2 thưởng gom 4 mèo trắng (50 điểm). |
| 3 | Gom thật to | Dạy | Cụm lớn = điểm lớn | 8 | 170 | 3 | Hàng `OO_OO`: 1 mèo cam là gom 5 (80 điểm). Sau đó tự chơi. |
| 4 | Ô gửi tạm | Dạy | Gửi tạm | 10 | 120 | 3 | Thẻ đầu sai màu: cất đi, đặt thẻ sau, chạm Gửi tạm lấy lại rồi gom. |
| 5 | Luyện tay | Luyện (nghỉ) | — | 12 | 200 | 3 | Không tutorial. Bàn thoáng, vài cặp mồi. |
| 6 | Mèo mướp | Biến tấu | Loại mèo thứ 4 | 12 | 220 | 4 | Thêm mèo mướp: 4 loại khó ghép hơn. Bàn có 4 cặp mồi, thẻ đầu là mèo mướp để làm quen. |
| 7 | Thùng gỗ | Biến tấu | Thùng gỗ chặn ô | 14 | 310 | 4 | 11 thùng chia cắt bàn. Thẻ L đầu gom 4 mèo xám và phá 3 thùng cùng lúc để người chơi thấy luật ngay. Tỉ lệ thẻ 3 ô cao. |
| 8 | Bàn chật | Thử thách nhỏ | Quản lý chỗ trống | 12 | 340 | 4 | Bàn kín ~24/36 ô, nhiều cặp sẵn nhưng dễ kẹt. Ít hỗ trợ màu. |
| 9 | Nhà đông mèo | Thả nhẹ | Mèo Xiêm | 16 | 270 | 5 | Thêm 1 loại mèo nhưng nhiều lượt, bàn thoáng. |
| 10 | Thử thách lớn | Đỉnh chương (Khó) | Đủ 6 loại | 18 | 410 | 6 | Nhãn "Khó" trên bản đồ và bảng giới thiệu. |

## 3. Tutorial

Các bước khai báo trong `levels.mjs` (`tutorial: [...]`), gồm 5 kiểu:

| Kiểu | Người chơi phải làm | Khoét sáng | Bàn tay |
|---|---|---|---|
| `drag` | Kéo thẻ vào đúng ô `anchor`; thả chỗ khác bị từ chối ("Kéo vào ô sáng nhé!"). `free: true` = chỉ gợi ý, đặt đâu cũng được | Thẻ đang bóc + các ô đích | Kéo từ thẻ tới ô đích, lặp lại |
| `rotate` | Chạm thẻ tới khi đúng hướng `offsets`; không nhấc thẻ lên được | Thẻ đang bóc | Nhấn nhịp |
| `hold` | Kéo thẻ vào Gửi tạm | Thẻ + ô Gửi tạm | Kéo từ thẻ tới ô |
| `tapHold` | Chạm ô Gửi tạm để đổi thẻ | Ô Gửi tạm | Nhấn nhịp |
| `info` | Đọc, bấm "Tiếp tục" | Không (tối cả màn hình) | Không |

Trong bước ép nước, các thao tác khác bị khoá (không xoay, không gửi tạm, không đặt sai ô). Hết bước, lớp tutorial tắt khoảng 0,7 giây để người chơi thấy anim gom rồi mới hiện bước kế.

## 4. Luồng màn hình

```
Mở game lần đầu ──► Giới thiệu màn 1 ──► Chơi (tutorial) ──► Qua màn (sao) ──► Màn tiếp ...
Đã từng chơi   ──► Bản đồ ──► chọn màn ──► Giới thiệu màn ──► Chơi
Thua (hết lượt / hết chỗ) ──► Chơi lại | Bản đồ
```

- **Bản đồ** (nút ☰ góc trái): 10 nút zigzag, mở khoá lần lượt, hiện sao tốt nhất, màn đang tới nhún nhảy, màn 10 màu đỏ "Khó".
- **Giới thiệu màn**: số màn, tên, cơ chế mới, mục tiêu điểm và số lượt.
- **Kết quả**: thắng thì sao bật lần lượt và có nút *Màn tiếp*; thua thì có nút *Chơi lại*. Cả hai đều có nút *Bản đồ*.
- Nút ↻ (góc phải) chơi lại màn hiện tại từ đầu (kể cả tutorial).
- **Tiến độ** lưu trong trình duyệt (`localStorage`, khoá `gomgom-rotate-progress-v1`): sao tốt nhất của từng màn. Màn N mở khi đã qua màn N-1.

**Sao** tính theo lượt còn dư lúc thắng: còn ≥ 30% lượt được 3 sao, còn ≥ 12% được 2 sao, còn lại 1 sao.

## 5. Bộ chia thẻ

Mỗi màn phát hết `deck` kịch bản trước (thẻ viết gọn: `O` đơn, `OG` đôi ngang, `O|G` đôi dọc, `I:`/`V:`/`L:` thẻ ba), sau đó phát thẻ ngẫu nhiên:

- **Hình thẻ** theo tỉ lệ `shapes` (mặc định 6 đơn : 5 đôi : 1 ba; màn 7 là 4 : 4 : 3).
- **Màu** lấy trong các loại mèo của màn (`cats`). Với xác suất `assist` (0,3–0,5), màu được chọn theo mèo đang có trên bàn, để người chơi ít bị bí mà vẫn cần tính toán.

Ký tự mèo: `O` cam, `G` xám, `W` trắng, `K` mun, `S` Xiêm, `T` mướp.

## 6. Cân bằng bằng mô phỏng

`node tools/simulate-levels.mjs [số ván]` cho bot tham lam chơi từng màn (xét mọi hướng xoay, mọi ô, có dùng Gửi tạm, nhìn 1 nước). Công cụ cũng kiểm tra dữ liệu: bàn đầu không có sẵn cụm gom được, thẻ kịch bản hợp lệ. Thêm `--sweep` để xem tỉ lệ thắng theo nhiều mức mục tiêu.

Bot chỉ nhìn 1 nước nên yếu hơn người chơi có kinh nghiệm; tỉ lệ thắng của bot là **cận dưới**. Kết quả 1000 ván mỗi màn:

| Màn | Thắng (bot) | Sao TB | Mục tiêu đường cong |
|---|---|---|---|
| 1 | 100% | 3,0 | 100% (tutorial) |
| 2 | 100% | 3,0 | 100% (tutorial) |
| 3 | 100% | 2,5 | ~100% |
| 4 | 100% | 2,7 | ~100% |
| 5 | 94% | 1,9 | 90–95% (nghỉ) |
| 6 | 84% | 1,8 | 85–90% |
| 7 | 79% | 1,4 | 80–85% |
| 8 | 71% | 1,5 | 70–75% (đỉnh nhỏ) |
| 9 | 88% | 1,7 | 85% (thả nhẹ) |
| 10 | 54% | 1,2 | 55–60% (đỉnh chương) |

Muốn chỉnh một màn: sửa `target`, `moves`, `assist` hoặc bàn trong `levels.mjs`, chạy lại mô phỏng và so với cột mục tiêu.

## 7. Hướng mở rộng cho các chương sau

- **Vật cản nâng cấp**: thùng 2 lớp (gom 2 lần mới vỡ), đá không vỡ được, thêm "mục tiêu phá hết thùng" bên cạnh mục tiêu điểm.
- **Mục tiêu theo loại mèo**: "gom 12 mèo cam" thay vì chỉ tính điểm, để đa dạng cách chơi.
- **Trợ giúp**: +5 lượt khi thua (đổi bằng xem quảng cáo / tiền trong game), búa xoá một ô.
- **Nhịp chương**: mỗi chương 10 màn theo cùng khuôn: 1–2 màn dạy cơ chế mới, 2–3 màn luyện, 1 màn đỉnh nhỏ, 1 màn nghỉ, màn cuối là đỉnh chương.

## 8. Thùng gỗ (vật cản)

- Ký tự `X` trên bàn trong `levels.mjs`. Thùng chiếm ô: không đặt mèo lên được, không bao giờ được tính vào cụm gom.
- Khi một cụm bị gom, mọi thùng nằm sát (trên/dưới/trái/phải) một ô vừa gom đều vỡ (1 lần là vỡ). Vỡ thùng không cho điểm, nhưng mở lại ô trống. Luật nằm ở `clearMatches` trong `board-rules.mjs`, có kiểm thử riêng.
- Hiệu ứng: thùng giữ nguyên chỗ tới đúng lúc cụm mèo chụm lại, rung lên rồi vỡ thành mảnh gỗ văng ra kèm khói. Dòng thông báo ghi "Phá N thùng!". Khi thắng, các thùng còn lại vỡ hết.
- Tác động đo bằng mô phỏng (màn 7, mục tiêu 310, 1000 ván): không thùng 86% → 7 thùng 84% → 10 thùng 81% → 12 thùng 77%. Thùng làm màn khó hơn đều theo số lượng, nên dùng số thùng như một nút vặn độ khó bên cạnh mục tiêu điểm.
