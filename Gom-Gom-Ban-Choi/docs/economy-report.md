# Báo cáo kinh tế (tự sinh — đừng sửa tay)

Sinh bởi `npm run economy` từ [game/gameplay/economy.mjs](../game/gameplay/economy.mjs). Sửa số ở file đó rồi chạy lại lệnh.

- **Xu nhận**: tổng xu thưởng khi thắng lần đầu mọi màn trong stage.
- **Giá mở khu kế**: số xu trả để mua khu có mốc màn trong stage (economy.mjs AREA_UNLOCK.cost). Không cộng vào tổng giá đồ.
- **Món gốc / Kiểu khác / Tường-sàn**: tổng giá các món *mở trong stage đó* (số trong ngoặc = số món). Món giá 0 và mèo không tính.
- **Tổng giá đồ mở**: mua hết mọi thứ mở trong stage (gốc + kiểu khác + tường/sàn).
- **Đủ mua … (luỹ kế)**: tổng xu nhận được tới hết stage chia cho tổng giá đồ đã mở tới hết stage. ≥ 100% = mua hết được.

| Stage | Màn | Khu mở đồ | Xu nhận | Giá mở khu kế | Món gốc | Kiểu khác | Tường / sàn | Tổng giá đồ mở | Xu nhận / giá món gốc | Xu luỹ kế | Đủ mua món gốc (luỹ kế) | Đủ mua tất cả (luỹ kế) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1–10 | Garden | **2,750** | 550 | 2,200 (9) | 4,400 (18) | 960 (6) | **7,560** | 125% | 2,750 | 125% | 36% |
| 2 | 11–20 | Garden 2 | **8,083** | 1,550 | 6,160 (8) | 12,320 (16) | 0 (0) | **18,480** | 131% | 10,833 | 130% | 42% |
| 3 | 21–30 | Living room | **13,787** | 2,550 | 12,320 (9) | 24,640 (18) | 8,470 (11) | **45,430** | 112% | 24,620 | 119% | 34% |
| 4 | 31–40 | Bedroom | **20,260** | 3,550 | 20,290 (8) | 40,580 (16) | 16,560 (12) | **77,430** | 100% | 44,880 | 110% | 30% |
| 5 | 41–50 | Kitchen | **27,199** | 4,550 | 31,880 (8) | 63,760 (16) | 36,300 (15) | **131,940** | 85% | 72,079 | 99% | 26% |
| 6 | 51–60 | Bathroom | **34,898** | 5,550 | 45,240 (8) | 90,480 (16) | 31,560 (12) | **167,280** | 77% | 106,977 | 91% | 24% |
| 7 | 61–70 | Backyard | **43,308** | 6,550 | 74,570 (8) | 149,140 (16) | 20,880 (4) | **244,590** | 58% | 150,285 | 78% | 22% |
| 8 | 71–80 | Kindergarten | **52,662** | 0 | 88,200 (8) | 176,400 (16) | 24,000 (4) | **288,600** | 60% | 202,947 | 72% | 21% |
| 9 | 81–90 | — | **63,014** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 265,961 | 95% | 27% |
| 10 | 91–100 | — | **74,365** | 0 | 0 (0) | 0 (0) | 0 (0) | **0** | — | 340,326 | 121% | 35% |

**Tổng cả game** (100 màn): nhận 340,326 xu · món gốc 280,860 xu · mọi đồ 981,310 xu.

Chỗ tiêu khác: booster hammer 60 · swap 40 · moves 80 xu/cái. Gói xu (tiền thật, chưa bán): 500 xu = $0.99 · 1,200 xu = $1.99 · 3,000 xu = $4.99.
