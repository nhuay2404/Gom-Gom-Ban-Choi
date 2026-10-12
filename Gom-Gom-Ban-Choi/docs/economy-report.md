# Báo cáo kinh tế (tự sinh — đừng sửa tay)

Sinh bởi `npm run economy` từ [game/gameplay/economy.mjs](../game/gameplay/economy.mjs). Sửa số ở file đó rồi chạy lại lệnh.

- **Xu nhận**: tổng xu thưởng khi thắng lần đầu mọi màn trong stage.
- **Giá mở khu kế**: số xu trả để mua khu có mốc màn trong stage (economy.mjs AREA_UNLOCK.cost). Không cộng vào tổng giá đồ.
- **Món gốc / Kiểu khác / Tường-sàn**: tổng giá các món *mở trong stage đó* (số trong ngoặc = số món). Món giá 0 và mèo không tính.
- **Tổng giá đồ mở**: mua hết mọi thứ mở trong stage (gốc + kiểu khác + tường/sàn).
- **Đủ mua … (luỹ kế)**: tổng xu nhận được tới hết stage chia cho tổng giá đồ đã mở tới hết stage. ≥ 100% = mua hết được.

| Stage | Màn | Khu mở đồ | Xu nhận | Giá mở khu kế | Món gốc | Kiểu khác | Tường / sàn | Tổng giá đồ mở | Xu nhận / giá món gốc | Xu luỹ kế | Đủ mua món gốc (luỹ kế) | Đủ mua tất cả (luỹ kế) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1–10 | Garden | **3,000** | 350 | 1,380 (9) | 2,760 (18) | 600 (6) | **4,740** | 217% | 3,000 | 217% | 63% |
| 2 | 11–20 | Garden 2 | **8,250** | 550 | 1,620 (6) | 1,620 (6) | 0 (0) | **3,240** | 509% | 11,250 | 375% | 141% |
| 3 | 21–30 | Living room | **13,500** | 800 | 1,770 (9) | 5,310 (27) | 1,210 (11) | **8,290** | 763% | 24,750 | 519% | 152% |
| 4 | 31–40 | Bedroom | **18,750** | 1,300 | 1,520 (7) | 4,560 (21) | 1,440 (12) | **7,520** | 1234% | 43,500 | 692% | 183% |
| 5 | 41–50 | Kitchen | **24,000** | 1,500 | 1,510 (7) | 4,530 (21) | 1,950 (15) | **7,990** | 1589% | 67,500 | 865% | 212% |
| 6 | 51–60 | Bathroom | **29,250** | 2,000 | 2,210 (7) | 4,420 (14) | 1,680 (12) | **8,310** | 1324% | 96,750 | 967% | 241% |
| 7 | 61–70 | Backyard | **34,500** | 0 | 2,150 (8) | 0 (0) | 600 (4) | **2,750** | 1605% | 131,250 | 1079% | 306% |
| 8 | 71–80 | — | **39,750** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 171,000 | 1406% | 399% |
| 9 | 81–90 | — | **45,000** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 216,000 | 1776% | 504% |
| 10 | 91–100 | — | **50,250** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 266,250 | 2190% | 621% |

**Tổng cả game** (100 màn): nhận 266,250 xu · món gốc 12,160 xu · mọi đồ 42,840 xu.

Chỗ tiêu khác: booster hammer 60 · swap 40 · moves 80 xu/cái. Gói xu (tiền thật, chưa bán): 500 xu = $0.99 · 1,200 xu = $1.99 · 3,000 xu = $4.99.
