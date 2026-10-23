# Gom Gom: rà soát kinh tế + monetization và thiết kế cho bản test thị trường

Viết 2026-10-22 (Sprint 7). Số liệu hiện trạng lấy từ `game/data/economy.mjs`, `npm run economy`, `tools/levels/baseline.json` (bot) và code
`game/menu/shop.js`, `game/app/shared.js`, `game/play/result.js`, `game/core/adaptive.mjs` tại ngày viết.
Nguyên tắc trích từ wiki (`wiki/pages/…`, ghi `[[trang]]`). Wiki **không có** benchmark số (giá thị trường, tỉ lệ xem ads, conversion…):
mọi con số đề xuất bên dưới là giả định ban đầu của thiết kế, để trên Remote Config và chỉnh theo dữ liệu bản test.

> `docs/economy-overview.md` (12/10) đã cũ: công thức thưởng (`120 × 1.01^n`), idle 4%, bảng khu đều không còn đúng code. Đọc file này + `docs/economy-report.md`.

---

## 1. Hiện trạng

| Hạng mục | Đang có |
|---|---|
| Xu | Thắng màn lần đầu (67 xu màn 1 → 519 màn 10 → 3,041 màn 50 → 7,946 màn 100; tổng 340K) + xu idle (~12%). Tiêu: đồ deco (món gốc 281K, mọi đồ 981K), mở khu (550 → 6,550), booster |
| Booster | Búa 60 · Thẻ mới 40 · +3 lượt 80 **xu**; tặng 3 mỗi loại khi mở (màn 3); quà an ủi +1 lượt khi sắp bỏ game |
| Gem | Chỉ là pill "0 · coming soon" trên ví + 2 nút placeholder (×3 booster = 30 gem). Không nguồn, không chỗ tiêu |
| IAP | 3 gói xu ($0.99/500 · $1.99/1,200 · $4.99/3,000) + starter $1.99: đều "coming soon" |
| Ads | Không có trong game (`tools/ads/` là video quảng cáo marketing) |
| Thua màn | Chỉ có Retry miễn phí, vô hạn. Không có continue / +lượt khi thua. Không có mạng (thanh năng lượng đã cắt 14/10) |
| DDA | Thua → lần chơi lại nới hàng thẻ (thẻ đôi / assist). Màn paywall (10) và boss không nới |

## 2. Điểm yếu, chưa hợp lí

**A. Không có pinch point nào — điểm yếu lớn nhất.** Wiki: người chơi chỉ trả tiền khi "hết một thứ có giá trị" tạo ra nút thắt mềm,
và người không trả vẫn có đường đi qua bằng thời gian ([[concept-monetization-strategies]]). Hiện tại thua thì Retry miễn phí vô hạn, lần sau
DDA còn nới dễ hơn. Không có gì để mất khi thua → không có lý do dùng booster, chưa nói tới mua. Đây là chỗ match-3 kiếm tiền nhiều nhất
(continue khi hết lượt, dựa trên loss aversion: [[concept-reward-design-and-psychology]]) và game đang bỏ trống.

**B. Booster bán bằng xu với giá cố định = gần như miễn phí.** Giá 40–80 xu không đổi trong khi thưởng màn tăng 120 lần. Màn 50 thưởng 3,041 xu
= 38 cái +lượt. Booster vừa không phải sink xu, vừa không thể bán bằng tiền thật. Nó lại là thứ duy nhất "performance" trong game, tức là
thứ đáng bán nhất ([[concept-monetization-strategies]]: monetize sức mạnh / tốc độ).

**C. Gói xu tiền thật lệch hẳn quy mô giá.** $4.99 = 3,000 xu = thưởng của đúng một màn 50; một món sân sau ~9,000 xu. Càng về sau gói càng
vô giá trị. Gốc vấn đề: bán trực tiếp một tiền tệ mềm đang lạm phát theo tiến độ ([[concept-live-ops-and-inflation]]).

**D. Gem là tiền tệ "chết" đang hiện trên ví.** Hiện ra mà chạm vào chỉ có "coming soon" làm game trông dở dang ở bản test.

**E. Xu thừa ở màn 81–100, chật ở 61–80.** Lô 61–70 / 71–80 chỉ đủ 58–60% giá món gốc của khu vừa mở (luỹ kế còn 72% ở màn 80),
rồi màn 81–100 không mở khu nào mà thưởng vẫn tăng → luỹ kế vọt lên 121%. Nhịp "thiếu rồi thừa" ngược với ý muốn: chỗ chật (61–80) chưa có
cách nào bù (không ads, không IAP), chỗ thừa thì xu hết nghĩa.

**F. DDA và monetization (đã kiểm lại code, ổn).** Lo ngại ban đầu: thua → lần sau dễ hơn → "cứ Retry là qua". Thực tế `adaptive.mjs` chỉ nới
hàng thẻ từ lần thua **thứ 2** liên tiếp ở cùng màn (`ADAPTIVE.STUCK_AFTER` / `MOVES_AFTER` = 2; người hay bỏ ngang thì từ lần 1), nên lần thua đầu
người chơi vẫn gặp màn continue + ads trước. Giữ nguyên, không thêm tham số.

**G. Paywall màn 10 hiện là tường cứng lần đầu.** Lần đầu vào màn 10 hàng thẻ xấu tới mức bot giỏi + 3 booster +lượt vẫn 0/300.
Đây lại đúng khoảng D1 được đo. Người chơi thua dù đã dùng hết booster, chưa từng thấy continue, nên sẽ hiểu là "game ăn gian" chứ không học được
gì về monetization.

**H. Sao không có giá trị kinh tế.** Xu thưởng không phụ thuộc sao, chơi lại không ra gì → sao chỉ để trưng. Một nguồn tự nhiên cho gem /
nhiệm vụ đang bị bỏ phí (xếp sau, Sprint 8 Daily có thể dùng).

**Điểm tốt nên giữ**: deco + mở khu bằng xu là meta đúng kiểu "personalization" ít gây khó chịu; xu màn 1–60 bám sát giá món gốc (99–131% luỹ kế);
idle nhỏ đúng vai quà quay lại; mọi số đã nằm trên Remote Config nên A/B được ngay.

---

## 3. Hướng đi

Gom Gom = **match-3 casual có meta trang trí nhà mèo**. Kiếm tiền theo đúng hình mẫu của thể loại, chia vai rõ cho hai tiền tệ:

| | **Xu (soft)** | **Gem (hard)** |
|---|---|---|
| Vai trò | Tiến độ meta: "chơi để xây nhà" | Sức mạnh trong màn: "trả để qua màn khó" |
| Nguồn chính | Thắng màn, idle, ads | Mua tiền thật; ít miễn phí để dạy cách dùng |
| Tiêu | Đồ deco, mở khu | Booster, continue khi thua, bù xu khi thiếu, đồ deco premium |
| Không bao giờ | Mua booster / continue | Bắt buộc để mở khu / mua món gốc |

Lý do: wiki khuyên một kho trung tâm hard currency cho mọi giao dịch tiền thật, giá linh hoạt và cho phép tặng ít miễn phí
([[concept-monetization-strategies]]). Booster là consumable nên là **sink vô hạn** của gem, không bao giờ "mua hết" như đồ deco
([[concept-live-ops-and-inflation]]). Xu tách khỏi tiền thật thì được phép lạm phát theo tiến độ mà không làm hỏng giá IAP.

Mô hình doanh thu bản test: **continue + booster (IAP) là chính, rewarded ads là đường đi của người không trả tiền**, interstitial nhẹ hoặc tắt.
Giữ **không có mạng / năng lượng** ở bản test (đã cắt; vừa bảo vệ D1 vừa đỡ một biến số); pinch point dồn hết vào continue.

---

## 4. Booster: mua bằng gem, có thời điểm gợi ý, mua được bằng ads

### 4.1 Giá (gem)
Tỉ giá gốc: **$1 ≈ 100 gem** (mốc wiki dùng, [[concept-store-and-pricing]]).

| Booster | 1 cái | Gói ×3 (−15%) | Ghi chú |
|---|---|---|---|
| +3 lượt | 25 | 65 | Rẻ nhất: cửa ngõ để người chơi quen tiêu gem. Yếu nhất (mục 4.2) |
| Búa 3×3 | 45 | 115 | Ăn điểm + phá vật cản + cứu bàn kẹt |
| Thẻ mới (swap) | 60 | 155 | Mạnh nhất: 3 lượt liền thẻ tốt nhất cho bàn |
| **Continue** (+5 lượt khi hết lượt) | 75 → 130 → 220 | — | Tăng dần trong cùng một lần chơi, tối đa 3 lần. Thua vì hết chỗ: continue = 1 búa miễn phí + 2 lượt, cùng giá |

- Continue là chỗ kiếm gem chính (bán đúng lúc người chơi vừa suýt thắng, sợ mất cả ván). Giá chốt **75 → 130 → 220**
  (22/10: 90 → 150 → 250, rồi thử 60 → 120 → 200, rồi nâng lên 75 sau khi màn "So close!" có thêm dòng kích mua). Lần đầu vẫn rẻ hơn mức gốc 90
  để nhiều người chịu continue và quen làm vậy; lần 2–3 đắt, là lúc người chơi phải mua gói gem. Gem miễn phí (~40 / ngày từ ads + quà mốc nhỏ) không đủ trọn
  một lần continue, nên lần continue đầu trong ngày dễ dẫn tới gói gem nhỏ.
- Màn "So close!" kích mua: dòng "You have X/Y points. Don't lose it now!" (công sức sắp mất) + "Next continue: 💎130" (giá lần sau làm mỏ neo, lần này trông rẻ). +3 lượt giữ 25 gem (cửa vào rẻ).
- Mỗi lượt: continue 15 → 26 → 44 gem, +3 lượt mua trước ~8 gem. Rủi ro: người chơi canh mua +3 lượt ở lượt cuối thay vì để thua rồi continue.
  Đo ở bản test (tỉ lệ +3 lượt mua ở 1–2 lượt cuối so với tỉ lệ chấp nhận continue); nếu cao: không mời mua +3 lượt khi còn ≤ 2 lượt,
  hoặc nâng +3 lượt lên 35. A/B giá continue qua Remote Config `CONTINUE.prices` (vd. [75, 130, 220] với [60, 120, 200]).
- Bỏ `BOOSTER_PRICE` bằng xu và nút mua bằng xu ở Shop / booster bar.
- `BOOSTER_START_STOCK` 3 → **2** mỗi loại: hết kho quanh màn 15–20, sau khi người chơi đã quen dùng, đúng lúc gem miễn phí bắt đầu có.

### 4.2 Giá theo giá trị (EV): đo 22/10
Cách đo: bot chơi bằng luật thật của game (`game/core/session.mjs`, bot chọn nước `pickMove` của `tools/levels/bot.mjs`) trên màn 3–100,
mỗi màn 80 ván cho mỗi trường hợp (không booster / đúng 1 booster mỗi loại), cùng seed nên cùng hàng thẻ lúc đầu. Booster dùng lúc có lợi nhất:
+3 lượt khi còn 1 lượt; Búa khi còn 1 lượt (đập ô 3×3 lợi nhất) hoặc khi bàn kẹt; Thẻ mới khi còn 3 lượt hoặc khi bàn kẹt.
Hai kiểu người chơi (bot noise 25 = khá, 40 = trung bình) cho cùng thứ hạng; bảng dưới là người chơi trung bình.

| Nhóm màn | Thắng khi không booster | +3 lượt | Búa | Thẻ mới |
|---|---|---|---|---|
| Tất cả (98 màn) | 68% | +13% | +22% | +28% |
| Màn khó (24 màn thắng < 60%) | 29% | +20% | +39% | +56% |
| Màn dễ | 81% | +10% | +16% | +18% |
| Màn 3–30 | 68% | +21% | +20% | +31% |
| Màn 31–60 | 67% | +11% | +24% | +28% |
| Màn 61–100 | 69% | +8% | +22% | +25% |

Màn boss: 10 (paywall) 14% → +3 lượt 40% · Búa 36% · Thẻ mới 100%; 40: 39% → 48% · 83% · 89%; 60: 6% → 6% · 61% · 43%; 100: 11% → 23% · 45% · 55%.

- Vì sao: +3 lượt chỉ cứu ván suýt đủ điểm; từ màn 30 thua chủ yếu vì kẹt bàn nên thêm lượt ít tác dụng. Búa vừa ăn điểm vừa phá vật cản, cứu được
  bàn kẹt. Thẻ mới cho 3 lượt chắc chắn gom được.
- Định giá: lấy +3 lượt 25 gem làm mốc, giá các loại khác để mỗi gem mua được cùng lượng tỉ lệ thắng (~1.9–2.1 gem cho mỗi +1% thắng):

  | Booster | +% thắng | Giá cũ | Gem / +1% (cũ) | Giá mới | Gem / +1% (mới) |
  |---|---|---|---|---|---|
  | +3 lượt | +13% | 25 | 1.9 | 25 | 1.9 |
  | Búa | +22% | 40 | 1.8 | 45 | 2.0 |
  | Thẻ mới | +28% | 50 | 1.8 | 60 | 2.1 |

- Continue (+5 lượt, 75 gem lần đầu) cao hơn mức này có chủ ý: bán lúc người chơi vừa thấy mình suýt thắng.
- Thẻ mới gần như chắc chắn vượt lần đầu màn 10 (paywall, hàng thẻ xấu): gợi ý booster ở màn 10 nên chỉ vào Thẻ mới.
- Giới hạn: bot dùng booster theo luật cố định, người thật dùng sớm / muộn khác nên số tuyệt đối sẽ khác; thứ hạng giữa 3 loại ổn định ở cả hai kiểu bot.

### 4.3 Khi kho = 0, chạm booster → popup mua nhanh
Lựa chọn theo thứ tự: **[Xem ads: nhận 1]** (nếu còn lượt ads hôm nay) · **[+1 · giá]** · **[+3 · giá gói]**.

**Thiếu gem ở bất kỳ đâu** (booster, continue, bù xu khi thiếu): popup "Not enough gems · You need N more" với nút **[Buy gems]** → **chuyển thẳng
tới mục Gems của Shop** (quyết định 22/10: không hiện bảng giá đè, không đưa một mệnh giá). Đang trong ván thì **ván được treo lại**: mua gem xong
bấm Home là quay lại đúng chỗ, không ra bản đồ: từ màn continue thì màn "So close!" hiện lại (giữ số lần continue đã dùng), từ popup booster thì
chơi tiếp ván dở. Vào màn khác thay vì quay lại thì ván treo bị bỏ (ghi thua / bỏ ngang). Ngoại lệ: Shop chưa mở (trước bước hướng dẫn Decoration,
màn 5) thì mới hiện bảng gói gem đè lên. Ván treo: `play/result.js` `pendingRun` / `resumeRun`, Home gọi ở `menu/tabs.js` `showTab`. Code: `app/store.js` `ensureGems` phát sự kiện `gomgom:gem-shop`, `menu/shop.js` `openGemShop` mở Shop.

### 4.4 Thời điểm gợi ý (pulse nút + bong bóng ngắn, mỗi gợi ý tối đa 1 lần / lần chơi)
| Tình huống | Gợi ý | Ghi chú |
|---|---|---|
| Hết lượt, còn thiếu ≤ 30% điểm hoặc ≤ 2 mục tiêu | **Màn hình continue** với near-miss: thanh điểm thiếu bao nhiêu, mục tiêu nào còn | Lựa chọn: gem continue · ads +3 lượt (1 lần) · Bỏ cuộc. Xa nút hơn → bỏ qua, vào thẳng bảng thua |
| Còn ≤ 3 lượt và dự báo không đủ điểm | Pulse **+3 lượt** | Đã có `boosterTip`, chuyển từ "lần sau" sang ngay trong màn |
| Bàn sắp kín (không còn chỗ đặt thẻ hiện tại sau khi xoay) | Pulse **Búa** | |
| 2 lượt liền không gom được | Pulse **Thẻ mới** | |
| Lần chơi lại thứ 2+ của cùng một màn, màn boss / paywall | Đầu màn: pulse cả bar + nhãn "Free (ads)" nếu còn lượt | Đã có cho paywall, mở rộng cho boss |
| Màn 10 (paywall) lần đầu | **Continue đầu tiên miễn phí** (tutorial) + tặng 50 gem lúc kết thúc màn | Dạy cơ chế continue thay vì để người chơi thua trắng (vấn đề G) |

### 4.5 DDA
Không cần sửa: DDA đã chỉ nới hàng thẻ từ lần thua thứ 2 liên tiếp (xem vấn đề F).

---

## 5. Rewarded ads: chỗ đặt và giới hạn

Quy tắc wiki: RV là opt-in đổi lấy thứ **kém hơn** bản trả tiền, không được làm giảm IAP, phải giới hạn tần suất ([[concept-monetization-strategies]]).
Không hiện RV trước màn 6 (FTUE). Riêng bảng thắng: người chơi **luôn xem được** (quyết định 22/10), không chặn số lần mà cho thưởng giảm dần trong ngày.

| # | Chỗ đặt | Thưởng | Giới hạn / ngày | So với bản gem |
|---|---|---|---|---|
| 1 | Màn continue (hết lượt) | +3 lượt | 5, mỗi lần chơi tối đa 1, chỉ làm continue đầu tiên | Gem cho +5 và được continue tiếp |
| 2 | Bảng thắng: nút "▶ +N" (ghi đúng số xu thêm) | Lần 1–2 trong ngày +50% xu màn, từ lần 3 +20% | **Không giới hạn** | — |
| 3 | Popup booster hết kho | 1 booster loại đó | 3 (chung mọi loại) | Gem mua bao nhiêu cũng được, gói ×3 |
| 4 | Sau khi nhận xu idle ở Deco: nút "▶ +N" (8 giây) | +50% số vừa nhận | 1 | — |
| 5 | Shop: "Gem miễn phí" | 20 gem (tăng từ 10, 22/10) | 2 | 40 gem ≈ $0.40 |
| | **Tổng** | | 11 lượt có trần + bảng thắng không giới hạn | |

- Lần xem thứ N trong ngày hết → nút đổi thành "Come back tomorrow" (không ẩn hẳn, để người chơi biết mai có).
- Vì sao bảng thắng giảm dần chứ không x2: mô phỏng (40 người ảo / kiểu, xem ads ở mọi màn được phép) cho thấy x2 không giới hạn làm người chơi
  mua đủ nội thất gốc ngay ở màn 70 (không ads: 84–91), ví dư cuối game gấp 3–6 lần; +50% mọi màn vẫn vượt 100% giá món gốc từ màn 20.
  Lịch +50%, +50%, rồi +20%: người chơi trung bình 87–93% ở màn 20–70, người chơi ít 83–100%, mua đủ món gốc ở màn 74–83.
  Cách giảm dần theo lượt là gợi ý của hướng dẫn rewarded ads CrazyGames; giới hạn cứng 3–8 lần / ngày là mức các nhà cung cấp ads hay khuyên.
- Không làm "x3 / spin may rủi" ở bản test: một mức thưởng rõ ràng dễ đọc dữ liệu hơn.
- **Interstitial**: tắt ở đầu bản test (`INTERSTITIAL_ON = false`). Bật cho nhóm A/B từ tuần 3: chỉ sau thắng, từ màn 20, mỗi 3 màn, cách nhau ≥ 180 s,
  không sau thua, không trong 60 s sau một RV. Mọi giao dịch IAP tắt interstitial vĩnh viễn.

Remote Config: `REWARDED_ADS` `{ from: 6, caps: { continue: 5, bonusCoins: null, booster: 3, idle: 1, gems: 2 }, gems: 20, coinBonus: [0.5, 0.5, 0.2], idleBonus: 0.5 }`
(`null` = không giới hạn). Interstitial: chưa làm.

---

## 6. Kinh tế gem

### 6.1 Nguồn gem miễn phí
Quà mốc chỉ nhận **một lần** mỗi mốc (chơi lại màn đã thắng / mở lại khu thì không có). Mức giảm ngày 23/10 (cột "Trước").

| Nguồn | Lượng | Trước | Tới màn 10 | Tới màn 40 | Cả 100 màn |
|---|---|---|---|---|---|
| Có sẵn khi mở game | 0 | 0 | — | — | — |
| Thắng màn 10 lần đầu (paywall, sau bài học continue) | 50 | 100 | 50 | 50 | 50 |
| Thắng màn boss lần đầu (20, 30 … 100) | 15 | 25 | — | 45 | 135 |
| Mở mỗi khu deco (7 khu) | 20 | 50 | 20 | 80 | 140 |
| Thú cưng mới (5 mèo + 6 chó) | 0 | 10 | 0 | 0 | 0 |
| **Tổng quà mốc** | | | **70** (trước 170) | **175** (trước 485) | **325** (trước 785) |
| Quà đăng nhập hằng ngày | **không cho gem** (quyết định 22/10: quà đăng nhập là xu / booster / đồ) | | | | |
| Nhiệm vụ ngày | **không cho gem** (chỉ xu, `DAILY`) | | | | |
| RV "Gem miễn phí" ở Shop | 20 × 2 / ngày | | | | 40 / ngày |

Vì sao giảm (wiki): hard currency miễn phí nên là **lượng nhỏ để dạy cách dùng** ([[concept-economy-building-blocks]],
[[concept-monetization-strategies]]); nguồn vào lớn hơn nhiều so với chỗ tiêu thì người chơi không mua hard currency
([[liveops-vasiuk-f2p-economics-and-sunk-cost]]); hội đồng: hard currency nhỏ, chỉ ở mốc ([[council-topic-verdicts]]); Bycer xếp "tặng premium
currency để tập tiêu" vào nhóm phản người chơi ([[f2pdive-bycer-ethics-player-friendly-design]]). Game đã dạy bằng cách khác (2 booster tặng sẵn mỗi
loại, continue đầu ở màn 10 miễn phí), nên gem mốc chỉ còn là phần thưởng nhỏ. Mức cũ cho ~485 gem tới màn 40 (≈ 6 continue / 20 booster +3 lượt),
che mất điểm thiếu (pinch point) đúng giai đoạn mua lần đầu, và ví có sẵn 170 gem làm gói Starter (300 gem) ở màn 10 kém hấp dẫn.
Paywall 50 < một continue (75): người chơi vừa đủ mua 2 booster +3 lượt, thiếu gem ở lần continue kế tiếp.

Nguồn gem lặp lại hằng ngày giờ gần như chỉ còn ads ở Shop (40 / ngày ≈ $0.40): đây là nguồn lớn nhất (~1,200 / tháng nếu xem đủ), chỉnh qua
`REWARDED_ADS.gems` / `caps.gems` nếu số dư gem sau test vẫn tăng đều. Chủ ý: miễn phí đủ để **thói quen tiêu gem** hình thành, không đủ cho mọi màn khó.
Kiểm sau test: phân bố số dư gem (wiki: xem người chơi tiêu gem miễn phí vào đâu, [[concept-analytics-and-kpis]]). Nếu trung vị số dư cứ tăng → nguồn quá nhiều hoặc giá quá cao.

### 6.2 Chỗ tiêu gem
1. **Booster + continue** (mục 4): sink chính, vô hạn.
2. **Bù xu khi thiếu** (quyết định 22/10, thay cho túi xu ở Shop): không có gói / mốc đổi gem → xu. Mua đồ hoặc mở khu mà thiếu xu thì game hỏi
   "You need N more. Use all your coins and pay the rest with gems?": người chơi trả **hết xu đang có + số gem tương ứng phần thiếu**.
   Số gem tính ngầm theo tiến độ: thiếu đúng 1 lần thưởng của màn đang chơi = 20 gem (`COIN_TOP_UP.gemsPerLevel`, làm tròn lên, tối thiểu 1).
   Ví dụ màn 15 thiếu 110 xu → 3 gem; màn 10 thiếu 550 xu → ~15 gem (thử thật trên trình duyệt). Bán đúng lúc người chơi đang muốn món đó
   (popup theo ngữ cảnh, [[concept-store-and-pricing]]); người chơi chỉ thấy giá gem, không thấy tỉ giá xu thay đổi theo màn.
   Có ở: mua đồ trong Shop → Decoration, mua kiểu khác / xây món gốc ở Deco, mở khu mới. Đây cũng là cách người trả tiền vượt khúc chật 61–80 (vấn đề E).
3. **Đồ deco premium** (mỗi khu 1 món chỉ bán bằng gem, 150–300 gem, có hoạt ảnh / tương tác mèo riêng): tầng "Ferrari" của personalization,
   không ảnh hưởng mở khu ([[concept-monetization-strategies]]). Làm sau bản test nếu thiếu thời gian (*có thể cắt*).

### 6.3 Tỉ giá với xu
Không có tỉ giá cố định 1 gem = N xu, và người chơi không thấy tỉ giá nào (xu lạm phát theo tiến độ). Tỉ giá ngầm neo theo **giá trị một màn**:
20 gem ≈ 1 màn thưởng. Bỏ hẳn gói xu bán bằng USD và túi xu bán bằng gem: xu chỉ ra tiền thật qua gem, lúc bù xu khi thiếu.

---

## 7. Cân lại kinh tế xu khi có gem + ads

| Thay đổi | Tác động |
|---|---|
| Booster rời khỏi xu | Mất một sink nhưng sink này vốn ~0 (vấn đề B): không cần bù |
| RV thêm xu ở bảng thắng (không giới hạn, +50% / +50% / rồi +20%) | Người xem mọi màn: +~20–28% xu. Lấp khúc chật: người chơi trung bình 70% → ~90% ở màn 40–70, không vượt 100% trước màn 80. **Giữ nguyên thưởng gốc màn 1–80** |
| **Thưởng tăng mãi** (`REWARD_FLAT_FROM = 0`; quyết định 22/10, thay cho bản dừng ở màn 80) | Game còn thêm màn + khu sau màn 100 và giá khu sau đắt hơn khu trước (hệ số ×1.6 → ×60), nên thưởng phải tăng theo, không thì mỗi khu mới phải chơi lâu hơn khu trước. Màn 81–100 tạm dư xu (luỹ kế ~121% giá món gốc) vì chưa có khu sau mẫu giáo: xu dư vẫn có chỗ tiêu ở kiểu khác + tường / sàn (981K tổng). Game cùng thể loại (Homescapes: 1 sao / màn) giữ thưởng cố định và lấy cảm giác tiến bộ từ nội dung mới; Gom Gom chọn thưởng tăng vì giá đồ tăng theo khu |
| Vườn hoa Đà Lạt (quà khi mở hết khu) + khu mới tiếp theo từ màn 81 qua live ops | Bù nội dung, không cần thêm số |
| Idle giữ 0.015; phải tích ≥ 30 phút mới nhận được (`IDLE_MIN_MINUTES`, 23/10: không nhận lắt nhắt liên tục, xu vẫn tính từ đầu) | RV idle +50%, 1 lần / ngày: đã tính trong số trên |
| **Giá khu theo công thức R** (23/10, thay `ZONE_PRICE_MULT` chỉnh tay ×1.6 → ×111 và `AREA_UNLOCK` 550 → 6,550) | Xem mục 7.1. Mô phỏng (thắng 70%): người chơi trung bình / ít chơi mở các khu ở gần đúng màn cũ (lệch ≤ 2 màn) |
| **Đồ deco không khoá theo màn** (23/10) | Khu mở là mua được mọi món, chỉ cần đủ xu. Chỉ thú cưng còn theo màn (quà nhận ở Map) |

Mô phỏng có ads: `simulatePlayer(..., { ads: { bonusCoins: lượt / ngày, idle: lượt / ngày, bonus: [tỉ lệ lần 1, 2, …], idleBonus } })` trong
`tools/economy/economy-sim.mjs` (editor Kinh tế chưa có cột này).
Mục tiêu: luỹ kế "đủ mua món gốc" nằm trong **85–110%** ở mọi mốc stage, với cả người không xem ads lẫn có xem.

### 7.1 Giá khu theo công thức R (23/10)
Mở khu không theo màn: xây đủ món gốc khu trước + trả xu; người chơi thấy trước giá ở bảng "2 khu kế tiếp". Giá mỗi khu **cố định**, tính một lần
từ R (xu thắng màn, bỏ dao động) ở màn mốc thiết kế 10n, n = thứ tự khu (vườn 2 = 1 … nhà trẻ = 7). Màn mốc chỉ để tính giá, không khoá gì.

```
giá mở khu        = 1.3 × R(10n)            (làm tròn 50 xu)
tổng giá món gốc  = k × R(10n)              k = 13 cho 2 khu đầu, 30 từ khu thứ 3
giá một món       = tổng giá món gốc × giá gốc món / tổng giá gốc món gốc của khu (bảng DECO; tường / sàn / kiểu khác cùng hệ số)
vườn gốc          = giá DECO × 1.6          (khu hướng dẫn)
```

Hằng số: `economy.mjs` `ZONE_PRICING` (một bản, không qua Remote Config). Bảng đã tính: `deco-data.mjs` `AREA_UNLOCK` / `ZONE_PRICE_MULT`.
k = 13 ở 2 khu đầu để 20 màn đầu vẫn vừa mua đủ món gốc (test kinh tế); k = 30 = mức trung bình các khu cũ đã dò tay (26–34 × R).

| Khu | n | Mở khu (cũ) | Tổng món gốc (cũ) |
|---|---|---|---|
| Vườn 2 | 1 | 650 (550) | 6,480 (6,156) |
| Phòng khách | 2 | 1,350 (1,550) | 13,660 (12,320) |
| Phòng ngủ | 3 | 2,150 (2,550) | 49,660 (50,715) |
| Bếp | 4 | 3,000 (3,550) | 69,640 (69,960) |
| Phòng tắm | 5 | 3,950 (4,550) | 91,610 (94,600) |
| Sân sau | 6 | 5,000 (5,550) | 115,740 (100,100) |
| Nhà trẻ | 7 | 6,150 (6,550) | 142,320 (163,170) |

**Thêm khu mới:** thêm id vào `AREA_ORDER` (deco-data.mjs) + món ở `DECO`, giá tự ra theo vị trí. Kiểm bằng `npm run economy` và mô phỏng
(`tools/economy/economy-sim.mjs`). Muốn đổi nhịp cả game: chỉnh k / 1.3 trong `ZONE_PRICING`.

---

## 8. Shop: gói IAP, giá, starter pack

Bố cục tab Shop từ trên xuống: **ưu đãi đang chạy (starter / trigger)** → **Gem miễn phí (RV)** → **gói gem** → **booster** (gem). Không có túi xu: thiếu xu thì bù gem ngay tại món (mục 6.2).
Gói đắt nhất đặt ngang tầm mắt làm mỏ neo giá ([[concept-store-and-pricing]], [[case-marvel-snap-and-the-finals]]).

### 8.1 Gói gem (6 SKU, bonus tăng dần)
| Giá | Gem | Bonus | Nhãn |
|---|---|---|---|
| $1.99 | 200 | — | |
| $4.99 | 550 | +10% | |
| $9.99 | 1,200 | +20% | **Most popular** (compromise effect: món giữa) |
| $19.99 | 2,600 | +30% | |
| $49.99 | 7,000 | +40% | |
| $99.99 | 16,000 | +60% (tăng từ 15,000, 22/10; 20,000 / +100% bị loại vì phá nhịp bonus tăng đều và hạ trần chi tiêu, [[concept-store-and-pricing]]) | **Best value** (mỏ neo) |

Mức thấp nhất là $1.99; cửa $0.99 chỉ dành cho starter pack để giá vào cửa rẻ là một món "hời" một lần, không phải gói thường.
Bản test ở chợ giá thấp (VN / PH / ID…) dùng bảng giá theo vùng của store, không tự quy đổi.

### 8.2 Starter pack (một lần, hạn 48 h)
- **Hiện**: lần đầu thắng màn 10 (vừa được dạy continue, vừa nhận 50 gem: chưa đủ một continue 75), đặt trên bảng kết quả + đầu Shop. Hết giờ thì mất; quay lại ở dạng
  "Welcome back" sau 7 ngày nếu chưa mua (Sprint 8 luồng quay lại).
- **$0.99**: 300 gem + 2 mỗi loại booster + **thảm Cozy Rug premium** (đồ deco chỉ có ở gói) + 2,000 xu.
  Giá trị hiển thị "x6" (≈ $6 theo bảng gem). Đồ deco độc quyền là lý do mua kể cả với người không cần booster (endowment, [[concept-reward-design-and-psychology]]).
- A/B giá: $0.99 vs $1.99 (cùng nội dung, $1.99 thêm 200 gem).

### 8.3 Ưu đãi theo tình huống (mỗi loại tối đa 1 lần / 3 ngày, hạn 24 h)
| Gói | Bật khi | Giá | Nội dung |
|---|---|---|---|
| Gói giải cứu | Thua cùng một màn 3 lần liên tiếp | $2.99 | 3 +lượt, 3 búa, 3 thẻ mới, 200 gem |
| Gói thợ xây | Vừa mở khu mới | $4.99 | 500 gem + xu = 2 món gốc của khu mới |
| No Ads | Chỉ khi interstitial bật | $3.99 | Tắt interstitial + 300 gem (RV vẫn còn, vì đó là phần thưởng) |

### 8.4 Để sau bản test
Cat Pass theo sự kiện 28 ngày ($4.99, thang free + trả phí, Sprint 9 *có thể cắt*); đồ deco premium mỗi khu; gói đăng ký.

---

## 9. Đo trong bản test

| Câu hỏi | Chỉ số |
|---|---|
| Continue có là pinch point thật? | % màn hình continue → chấp nhận (gem / ads / bỏ), theo màn; doanh thu từ continue / tổng |
| Paywall màn 10 có làm rơi D1? | Funnel màn 9 → 10 → 11, D1 theo nhóm đã / chưa thắng màn 10 |
| Gem miễn phí nhiều hay ít? | Trung vị số dư gem theo ngày 1/3/7; % người chưa từng tiêu gem |
| Ads có ăn vào IAP? | ARPDAU tách IAP / ads; RV / DAU theo chỗ đặt; % chạm trần mỗi chỗ |
| Xu có chật / thừa? | Xu dư khi mở khu, thời gian chờ đủ xu, tỉ lệ bù gem khi thiếu xu (và ở khu nào) |
| Conversion | % người mua ≥ 1 lần, tỉ lệ mua starter, ARPPU |

Wiki không có benchmark cho các chỉ số này ([[concept-analytics-and-kpis]]): lấy báo cáo thể loại match-3 hiện hành khi đặt ngưỡng đạt / không đạt.

## 10. Tham số Remote Config (đã vào `game/data/economy.mjs`)

| Tên | Mặc định |
|---|---|
| `BOOSTER_GEM_PRICE` / `BOOSTER_PACK_PRICE` | `{ moves: 25, hammer: 45, swap: 60 }` / gói ×3 `{ moves: 65, hammer: 115, swap: 155 }` (theo EV, mục 4.2) |
| `BOOSTER_START_STOCK` | 3 → 2 |
| `CONTINUE` | `{ prices: [75, 130, 220], moves: 5, adMoves: 3, stuckMoves: 2, minProgress: 0.7 }` |
| `START_GEMS` | 0 |
| `GEM_REWARDS` | `{ paywall: 50, boss: 15, area: 20, pet: 0 }` (23/10, trước: 100 / 25 / 50 / 10) |
| `GEM_PACKS` | 6 gói mục 8.1, kèm `id` sản phẩm store |
| `COIN_TOP_UP` | `{ gemsPerLevel: 20, minGems: 1 }` (thay `COIN_BAGS`: bù xu khi thiếu, không có túi xu) |
| `OFFERS` | `starter` / `rescue` / `builder` như mục 8 (Builder: xu = 12 × thưởng màn thay cho "2 món gốc") |
| `REWARDED_ADS` | `{ from: 6, caps: { continue: 5, bonusCoins: null, booster: 3, idle: 1, gems: 2 }, gems: 20, coinBonus: [0.5, 0.5, 0.2], idleBonus: 0.5 }` |
| `REWARD_FLAT_FROM` | 0 = thưởng tăng mãi (đặt > 0 để dừng tăng từ màn đó) |
| bỏ | `BOOSTER_PRICE` (xu), `COIN_PACKS`, `STARTER_PACK` |

---

## 11. Bàn giao dev: ads + IAP đang giả lập

Ads và tiền thật chưa tích hợp SDK. Bản này **giả lập** để chơi thử trọn luồng; mọi chỗ cần thay đều có chú thích tìm được bằng:

```bash
grep -rn "ADS-SDK\|IAP-SDK" game
```

| Phần | File | Đang làm gì | Dev thay bằng |
|---|---|---|---|
| Rewarded ads | `game/app/ads.js` → hàm `playAd()` | Màn đen đếm ngược **5 giây**, có nút Skip (= không nhận thưởng) | Rewarded video của SDK (AdMob / AppLovin MAX…); trả về true khi SDK báo "earned reward" |
| Mua tiền thật | `game/app/iap.js` → hàm `purchase()` | Hộp "Simulated purchase", bấm Buy là xong, không trừ tiền | Google Play Billing / StoreKit (qua Capacitor); `product.id` = id sản phẩm trên store; nên lấy giá theo vùng từ store |
| Analytics | `console.info('[ads] …' / '[iap] …' / '[analytics] continue …')` | In ra console | Gửi event thật |

**5 chỗ đặt rewarded ads** (tên chỗ đặt = khoá trong `REWARDED_ADS.caps`):

| Chỗ đặt | File | Khi nào hiện | Thưởng |
|---|---|---|---|
| `continue` | `game/play/continue.js` | Màn "So close!" khi thua (đạt ≥ 70% mục tiêu), chỉ ở lần continue đầu của ván | +3 lượt (thua vì hết chỗ: +1 búa + 2 lượt) |
| `bonusCoins` | `game/play/result.js` | Nút "▶ +N" dưới dòng xu ở bảng thắng (khi màn có xu), mọi lần thắng | Lần 1–2 trong ngày +50% xu màn, sau đó +20% |
| `booster` | `game/app/store.js` (`offerBooster`) | Popup khi chạm booster đã hết trong ván | 1 booster loại đó |
| `idle` | `game/menu/idle-coins.js` | Nút "▶ +N" hiện 8 giây sau khi nhận xu idle ở Deco, 1 lần / ngày | +50% số xu vừa nhận |
| `gems` | `game/menu/shop.js` | Dòng "▶ Free 💎20" đầu Shop | 20 gem |

Giới hạn mỗi ngày đếm ở `game/core/gems.mjs` (reset 0h giờ máy), ads chỉ có từ màn 6. Interstitial: chưa có (thiết kế: tắt ở đầu bản test).

**Sản phẩm IAP** (id trong `economy.mjs`): 6 gói gem `gems_200` … `gems_16000`, `starter_pack`, `rescue_pack`, `builder_pack`.

## 12. Đã làm trong game / chưa làm

Đã làm (22/10): ví gem (pill gem ở Home / Deco / Shop, chạm mở Shop); booster chỉ mua bằng gem (lẻ + gói ×3), popup hết booster
(ads / gem / thiếu gem → nút Buy gems chuyển thẳng tới mục Gems của Shop); màn continue near-miss (giá tăng dần, ads lần đầu, màn 10 continue đầu miễn phí); gợi ý booster
trong ván (+lượt khi sắp hết lượt mà thiếu điểm, búa khi bàn còn ≤ 5 ô trống, thẻ mới khi 2 lượt liền không gom); gem thưởng (màn 10, boss,
mở khu, thú cưng mới); thêm xu ở bảng thắng (không giới hạn, giảm dần), thêm xu idle, gem miễn phí ở Shop; Shop mới (ưu đãi đang chạy, gói gem, booster); thiếu xu thì trả hết xu + bù gem ngay tại món / khu; starter /
rescue / builder pack có hạn giờ; thưởng màn tăng mãi (mốc dừng để trên Remote Config, mặc định tắt).

Chưa làm: quà đăng nhập (không cho gem) + nhiệm vụ ngày (Daily, Sprint 8); interstitial + gói No Ads; đồ deco premium / thảm độc quyền trong starter pack
(chưa có model); pulse booster đầu màn cho boss từ lần chơi lại thứ 2; art Figma cho popup / thẻ ưu đãi (đang dùng style tạm `game/ui/shared/store.css`);
cột "có ads" trong mô phỏng kinh tế (editor).
