# Báo cáo kinh tế (tự sinh — đừng sửa tay)

Sinh bởi `npm run economy` từ [game/gameplay/economy.mjs](../game/gameplay/economy.mjs). Sửa số ở file đó rồi chạy lại lệnh.

- **Xu nhận**: tổng xu thưởng khi thắng lần đầu mọi màn trong stage.
- **Cần tiêu để mở khu kế**: số xu phải tiêu cho decor (từ lúc khu trước mở) để mở khu có mốc màn trong stage (economy.mjs AREA_UNLOCK.spend). Không phải chỗ tiêu thêm, không cộng vào tổng.
- **Món gốc / Kiểu khác / Tường-sàn**: tổng giá các món *mở trong stage đó* (số trong ngoặc = số món). Món giá 0 và mèo không tính.
- **Tổng giá đồ mở**: mua hết mọi thứ mở trong stage (gốc + kiểu khác + tường/sàn).
- **Đủ mua … (luỹ kế)**: tổng xu nhận được tới hết stage chia cho tổng giá đồ đã mở tới hết stage. ≥ 100% = mua hết được.

| Stage | Màn | Khu mở đồ | Xu nhận | Cần tiêu để mở khu kế | Món gốc | Kiểu khác | Tường / sàn | Tổng giá đồ mở | Xu nhận / giá món gốc | Xu luỹ kế | Đủ mua món gốc (luỹ kế) | Đủ mua tất cả (luỹ kế) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1–10 | Garden | **1,321** | 600 | 1,380 (9) | 2,760 (18) | 600 (6) | **4,740** | 96% | 1,321 | 96% | 28% |
| 2 | 11–20 | Garden 2 | **1,460** | 900 | 1,620 (6) | 1,620 (6) | 0 (0) | **3,240** | 90% | 2,781 | 93% | 35% |
| 3 | 21–30 | Living room | **1,611** | 1,100 | 1,840 (9) | 5,520 (27) | 1,210 (11) | **8,570** | 88% | 4,392 | 91% | 27% |
| 4 | 31–40 | Bedroom | **1,780** | 1,200 | 1,660 (7) | 4,980 (21) | 1,560 (12) | **8,200** | 107% | 6,172 | 95% | 25% |
| 5 | 41–50 | Kitchen | **1,967** | 1,300 | 1,750 (7) | 5,250 (21) | 2,250 (15) | **9,250** | 112% | 8,139 | 99% | 24% |
| 6 | 51–60 | Bathroom | **2,171** | 0 | 2,680 (7) | 5,360 (14) | 2,040 (12) | **10,080** | 81% | 10,310 | 94% | 23% |
| 7 | 61–70 | — | **2,400** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 12,710 | 116% | 29% |
| 8 | 71–80 | — | **2,652** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 15,362 | 141% | 35% |
| 9 | 81–90 | — | **2,928** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 18,290 | 167% | 41% |
| 10 | 91–100 | — | **3,236** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 21,526 | 197% | 49% |

**Tổng cả game** (100 màn): nhận 21,526 xu · món gốc 10,930 xu · mọi đồ 44,080 xu.

Chỗ tiêu khác: booster hammer 60 · swap 40 · moves 80 xu/cái. Gói xu (tiền thật, chưa bán): 500 xu = $0.99 · 1,200 xu = $1.99 · 3,000 xu = $4.99.
