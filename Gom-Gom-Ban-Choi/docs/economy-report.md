# Báo cáo kinh tế (tự sinh — đừng sửa tay)

Sinh bởi `npm run economy` từ [game/gameplay/economy.mjs](../game/gameplay/economy.mjs). Sửa số ở file đó rồi chạy lại lệnh.

- **Xu nhận**: tổng xu thưởng khi thắng lần đầu mọi màn trong stage.
- **Món gốc / Kiểu khác / Tường-sàn**: tổng giá các món *mở trong stage đó* (số trong ngoặc = số món). Món giá 0 và mèo không tính.
- **Tổng giá đồ mở**: mua hết mọi thứ mở trong stage (gốc + kiểu khác + tường/sàn).
- **Đủ mua … (luỹ kế)**: tổng xu nhận được tới hết stage chia cho tổng giá đồ đã mở tới hết stage. ≥ 100% = mua hết được.

| Stage | Màn | Khu mở đồ | Xu nhận | Món gốc | Kiểu khác | Tường / sàn | Tổng giá đồ mở | Xu nhận / giá món gốc | Xu luỹ kế | Đủ mua món gốc (luỹ kế) | Đủ mua tất cả (luỹ kế) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1–10 | Garden | **1,395** | 1,380 (9) | 2,760 (18) | 600 (6) | **4,740** | 101% | 1,395 | 101% | 29% |
| 2 | 11–20 | Garden 2 | **1,634** | 1,620 (6) | 1,620 (6) | 0 (0) | **3,240** | 101% | 3,029 | 101% | 38% |
| 3 | 21–30 | Living room | **976** | 1,600 (9) | 4,800 (27) | 1,100 (11) | **7,500** | 61% | 4,005 | 87% | 26% |
| 4 | 31–40 | Bedroom | **1,014** | 1,270 (7) | 3,810 (21) | 1,200 (12) | **6,280** | 80% | 5,019 | 86% | 23% |
| 5 | 41–50 | Kitchen | **800** | 1,160 (7) | 3,480 (21) | 1,500 (15) | **6,140** | 69% | 5,819 | 83% | 21% |

**Tổng cả game** (50 màn): nhận 5,819 xu · món gốc 7,030 xu · mọi đồ 27,900 xu.

Chỗ tiêu khác: booster hammer 60 · swap 40 · moves 80 xu/cái. Gói xu (tiền thật, chưa bán): 500 xu = $0.99 · 1,200 xu = $1.99 · 3,000 xu = $4.99.
