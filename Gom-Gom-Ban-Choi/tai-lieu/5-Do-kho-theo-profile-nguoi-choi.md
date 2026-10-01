# Gom Gom Rotate — Độ khó theo profile người chơi

Mục tiêu: màn sắp tới khó hay dễ tuỳ theo người chơi đang chơi thế nào. Người đang thắng liên tục thì được thử thách hơn; người đang thua liên tục thì được thả lỏng trước khi bỏ game. Đã tích hợp ngày 01/10/2026: `game/adaptive.mjs` (luật), `game/gom-gom.js` (thu metric, hiện nhãn), `game/adaptive.test.mjs` (test). Mục 8 ghi những chỗ bản cài khác thiết kế ban đầu.

## 1. Thang độ khó theo số element

Độ khó của một màn tính bằng số **element đang "bật"** trong 4 element: lượt (moves), số màu mèo, thùng gỗ (crate, `X`), khối kim loại (wall, `M`).

| Element | Bật khi | Ghi chú |
|---|---|---|
| Moves | Điểm cần mỗi lượt `target / moves ≥ 18` | Ngân sách lượt chật. Màn có lượt dư dả thì moves không tính là một áp lực. |
| Màu mèo | `cats` có ≥ 5 giống | 2–4 giống thì dễ ra cặp; từ 5 giống trở lên mới khó gom. |
| Crate | Bàn có ≥ 1 ô `X` | |
| Wall | Bàn có ≥ 1 ô `M` | |

| Nhãn | Số element bật |
|---|---|
| **Easy** | 1 (màn 0 element, tức tutorial và màn nghỉ, cũng xếp vào Easy) |
| **Medium** | 2–3 |
| **Hard** | 4 |

### 1.1 Áp thang này lên 20 màn hiện có

| Màn | Tên | Tier hiện tại | Điểm/lượt | Màu | X | M | Element bật | Nhãn mới |
|---:|---|---|---:|---:|---:|---:|---:|---|
| 1 | Hello, Kitty | normal | 15.0 | 2 | 0 | 0 | 0 | Easy |
| 2 | Round and Round | normal | 15.0 | 3 | 0 | 0 | 0 | Easy |
| 3 | Go Big | normal | 17.0 | 3 | 0 | 0 | 0 | Easy |
| 4 | Triple Cards | normal | **23.3** | 3 | 0 | 0 | 1 | Easy |
| 5 | Crates | normal | 15.0 | 3 | **5** | 0 | 1 | Easy |
| 6 | Crate Garden | normal | **18.6** | 4 | **6** | 0 | 2 | Medium |
| 7 | Tight Crates | hard | **22.5** | 4 | **6** | 0 | 2 | Medium |
| 8 | Steel Nap | chill | 13.3 | 4 | 0 | **4** | 1 | Easy |
| 9 | Iron & Oak | hard | **18.8** | **5** | **6** | **4** | 4 | **Hard** |
| 10 | Garden Fortress | boss | **18.5** | **6** | **8** | **4** | 4 | **Hard** |
| 11 | Fresh Start | normal | 17.1 | **5** | 0 | 0 | 1 | Easy |
| 12 | Crate Scatter | normal | 16.0 | **5** | **7** | 0 | 2 | Medium |
| 13 | Steel Corners | normal | **18.7** | **5** | 0 | **4** | 3 | Medium |
| 14 | Crate & Steel | hard | 16.9 | **6** | **6** | **4** | 3 | Medium |
| 15 | Open Field | normal | **20.7** | **6** | 0 | 0 | 2 | Medium |
| 16 | Crate Maze | hard | 16.3 | **6** | **6** | 0 | 2 | Medium |
| 17 | Divided | hard | 16.0 | **6** | 0 | **6** | 2 | Medium |
| 18 | Iron Gate | hard | **18.3** | **6** | **5** | **6** | 4 | **Hard** |
| 19 | Tea Break | chill | 14.5 | 4 | 0 | **4** | 1 | Easy |
| 20 | Steel Fortress | boss | 17.3 | **6** | **2** | **12** | 3 | Medium |

Tổng: 8 Easy · 9 Medium · 3 Hard. Hai chỗ lệch đáng chú ý:
- Màn 7, 14, 16, 17 đang gắn `hard` nhưng theo thang element chỉ là Medium (khó do layout chật, không do số element).
- Màn 20 là boss nhưng chỉ 3 element vì 22 lượt khá rộng (17.3 điểm/lượt). Muốn boss đúng nghĩa Hard thì cắt còn 21 lượt (18.1 điểm/lượt).

Thang element là thước đo thô; độ khó thật vẫn phải đo lại bằng `tools/simulate-levels.mjs` (tỉ lệ thắng của bot) mỗi khi đổi màn.

## 2. Metric thu thập

Ghi một bản ghi cho **mỗi lần thử** một màn (thắng, thua, hoặc bỏ giữa chừng):

| Metric | Cách đo | Dùng để |
|---|---|---|
| `win` | thắng/thua | chuỗi thắng, chuỗi thua |
| `reason` | `moves` (hết lượt) · `stuck` (hết chỗ) · `quit` (bỏ giữa chừng, bấm restart hoặc về map) | thua sát nút hay thua xa; bỏ ngang là dấu hiệu nản |
| `scoreRatio` | `score / target` lúc kết thúc | **sát nút** nếu thua mà ≥ 0.85; **thua xa** nếu < 0.6 |
| `stars`, `movesLeft` | lúc thắng | thắng dễ (3 sao) hay thắng chật vật (1 sao) |
| `attempt` | lần thử thứ mấy ở màn này | số lần chơi lại |
| `thinkMs` | trung vị thời gian từ lúc thẻ xuất hiện tới lúc đặt | tốc độ ra quyết định |
| `idleMs` | tổng các khoảng không chạm màn hình > 5 s (`TIMING.AFK_MS` đã có) | lưỡng lự, bí, hoặc mất hứng |
| `resultDwellMs` | thời gian đứng ở bảng kết quả trước khi bấm Retry / Next / Map | sau khi thua mà đứng lâu là dấu hiệu sắp bỏ |
| `boosters` | số booster dùng | thắng nhờ booster thì không tính là giỏi |

Idle chỉ so với **chính người đó**: lấy trung vị `thinkMs` của các lần thắng từ màn 3 tới màn 6 làm `baseThink`. Người suy nghĩ chậm bẩm sinh không bị coi là đang bí.

Tín hiệu tính trên **cửa sổ 5 lần thử gần nhất**:
- `winStreak`, `loseStreak`: chuỗi liên tiếp hiện tại.
- `retries`: số lần thử ở màn đang chơi.
- `idleUp`: `thinkMs` lần gần nhất > 1.5 × `baseThink`, hoặc `idleMs` chiếm > 25% thời gian màn.
- `fast`: `thinkMs` < 0.8 × `baseThink`.
- `nearMiss`: thua với `scoreRatio ≥ 0.85`.

## 3. Các profile và thuật toán ra màn

Profile xét theo thứ tự ưu tiên từ trên xuống; khớp profile nào trước thì dùng profile đó. Mỗi profile có (a) điều kiện nhận diện, (b) **đổi bao nhiêu element** cho màn kế tiếp so với bản gốc, (c) **hàng đợi 5 màn sắp tới** (E = Easy, M = Medium, H = Hard).

### P0. Người mới (Onboarding)
- **Nhận diện:** đang ở 4 màn đầu, hoặc tổng < 6 lần thử. Trong giai đoạn này game không nới độ khó, nhưng nếu người chơi thắng ngay lần đầu 3 màn liền thì vẫn chuyển sang P4/P6 để tăng khó.
- **Thuật toán:** không chỉnh, chơi đúng thứ tự thiết kế (màn 1–5 đều Easy). Chỉ thu metric để lập `baseThink`. Nếu thua 2 lần liên tiếp ở màn 3–5 thì +2 lượt cho lần sau (không đổi element nào khác).
- **Hàng đợi:** `E E E E E` (đúng thiết kế).
- **Vì sao:** chưa đủ dữ liệu; chỉnh sớm dễ đoán sai.

### P1. Sắp bỏ game (Frustrated / Churn risk)
- **Nhận diện:** `loseStreak ≥ 4`; hoặc `retries ≥ 5` ở một màn; hoặc thua 3 lần liền mà lần cuối có dấu hiệu nản (`idleUp` hoặc `resultDwellMs > 8 s`); hoặc 2 lần thua liền đều kèm `idleUp` và `resultDwellMs > 8 s`; hoặc bỏ ngang sau khi đã thua (`quit` khi `loseStreak ≥ 2`); hoặc **người chơi mong manh** (từng bỏ ngang trong 10 lần thử gần nhất) thua 2 lần liền.
- **Thuật toán:**
  1. Lần thử kế tiếp ở **chính màn này**: hạ thẳng về Easy (tắt element tới khi còn 1).
  2. Ba màn sau đó: tối đa Medium (2 element), không có Hard.
  3. Màn thắng đầu tiên sau chuỗi thua tặng thêm 1 booster miễn phí.
- **Hàng đợi:** `E E M E M`
- **Thoát:** thắng 2 màn liên tiếp → chuyển sang P5 (Ổn định).

### P2. Đang vật lộn (Struggling)
- **Nhận diện:** `loseStreak` 2–3, hoặc `retries` 3–4, và **không** phải thua sát nút. Người chơi mong manh thì thua 1 lần đã vào P2.
- **Thuật toán:** mỗi lần thua thêm thì màn này tắt bớt 1 element (tối đa tắt 2, không xuống dưới Easy). Màn kế tiếp sau khi thắng giữ nguyên số element của màn vừa thắng, không tăng lại ngay.
- **Hàng đợi:** `M E M M H` (Hard đẩy lùi về vị trí cuối).
- **Thoát:** thắng 2 màn → P5; thua thêm → P1.

### P3. Thua sát nút (Near-miss)
- **Nhận diện:** 2 lần thua gần nhất đều `nearMiss`, chưa chơi lại tới lần thứ 5, và không phải người chơi mong manh.
- **Thuật toán:** **giữ nguyên độ khó**, vì đây là lúc người chơi muốn thử lại hoặc dùng booster (cũng là chỗ thu tiền tốt nhất). Mời booster +3 lượt ở bảng thua. Chỉ khi thua sát nút lần thứ 4 mới nới **duy nhất moves** (+2 lượt), không đụng layout.
- **Hàng đợi:** giữ đúng hàng đợi của profile trước đó.
- **Thoát:** thắng → P5; thua xa → P2.

### P4. Cao thủ (Hot streak / Skilled)
- **Nhận diện:** thắng **ngay lần đầu** 3 màn liền, không dùng booster, `thinkMs` không tăng bất thường. Không còn yêu cầu số sao.
- **Thuật toán:**
  1. Màn kế tiếp bật thêm 1 element so với bản gốc (tối đa Hard).
  2. Thứ tự bật: moves trước (chật lượt: `moves = floor(target / 18)`), sau đó màu (thêm giống tới khi đủ 5).
  3. Màn nghỉ (`chill`) vẫn giữ nhưng chỉ còn 1 màn nghỉ trên 6 màn thay vì trên 4.
  4. `winStreak ≥ 6`: thêm 1 element nữa (tức +2 so với gốc).
- **Hàng đợi:** `M H H M H`
- **Thoát:** thua 1 lần → giảm về +1; thua 2 lần → P5.

### P5. Ổn định (Steady / In flow)
- **Nhận diện:** mặc định khi không khớp profile nào ở trên; thường tỉ lệ thắng 50–80% trên cửa sổ 5 lần.
- **Thuật toán:** không chỉnh, chạy đúng nhịp răng cưa đã thiết kế (lên dần, nghỉ, boss).
- **Hàng đợi:** `M M H E M` (răng cưa gốc).

### P6. Chơi chán (Coasting / Bored)
- **Nhận diện:** thắng ngay lần đầu 3 màn liền **nhưng** thời gian nghĩ tăng dần (lần thứ 3 > 1.3 × lần thứ 1), hoặc đứng lâu ở bảng kết quả sau 2 lần thắng gần nhất: thắng dễ mà không còn hứng.
- **Thuật toán:** khác P4 ở chỗ cần **cái mới**, không chỉ cần khó hơn. Màn kế tiếp đổi loại element thay vì cộng thêm: màn đang thiên crate thì đổi sang wall và ngược lại, giữ tổng số element. Sau đó một màn Hard để tạo đỉnh.
- **Hàng đợi:** `M(đổi element) H E M H`
- **Thoát:** idle về bình thường → P5 hoặc P4.

### P7. Suy nghĩ kỹ (Thinker)
- **Nhận diện:** `thinkMs` cao (> 1.5 × trung vị chung) nhưng vẫn thắng ≥ 60%.
- **Thuật toán:** **không** coi idle là bí. Dùng hàng đợi của P5, chỉ dựa vào thắng/thua. Không bật thêm moves (người này thua vì lượt chứ không vì chậm), nếu cần tăng khó thì bật màu hoặc vật cản.
- **Hàng đợi:** như P5.

### P8. Quay lại sau thời gian nghỉ (Returning)
- **Nhận diện:** lần mở game gần nhất cách đây ≥ 3 ngày.
- **Thuật toán:** màn đầu tiên của phiên tắt bớt 1 element (khởi động), màn thứ hai về đúng gốc. Các tín hiệu chuỗi thắng/thua cũ được xoá, `baseThink` giữ nguyên.
- **Hàng đợi:** `E M` rồi về profile tính lại.

### Tóm tắt

| Profile | Tín hiệu chính | Đổi element màn kế | Hàng đợi 5 màn |
|---|---|---|---|
| P0 Người mới | 4 màn đầu / < 6 lần thử | 0 (chỉ +2 lượt khi thua 2 lần; thắng sạch liền vẫn được tăng khó) | E E E E E |
| P1 Sắp bỏ | thua ≥ 4 / chơi lại ≥ 5 / thua 3 + dấu hiệu nản / bỏ ngang sau khi thua / mong manh thua 2 | về Easy | E E M E M |
| P2 Vật lộn | thua 2–3 / chơi lại 3–4 | −1 mỗi lần thua (tối đa −2) | M E M M H |
| P3 Sát nút | 2 lần thua ≥ 85% điểm | 0 (lần 4: +2 lượt) | giữ nguyên |
| P4 Cao thủ | thắng ngay lần đầu 3 màn liền, không booster | +1 (6 màn liền: +2) | M H H M H |
| P5 Ổn định | mặc định | 0 | M M H E M |
| P6 Chơi chán | thắng dễ nhưng idle tăng | đổi loại, giữ số | M H E M H |
| P7 Suy nghĩ kỹ | idle cao nhưng thắng | như P5, không siết moves | M M H E M |
| P8 Quay lại | nghỉ ≥ 3 ngày | −1 ở màn đầu phiên | E M → tính lại |

## 4. Bật/tắt element trên một màn

Mỗi màn có **bản gốc** (đang có trong `levels.mjs`). Bộ chỉnh tạo bản biến thể bằng cách bật/tắt từng element:

| Element | Tắt (dễ hơn) | Bật (khó hơn) |
|---|---|---|
| Moves | `moves = ceil(target / 16)` | `moves = floor(target / 18)` |
| Màu mèo | bỏ giống cuối trong `cats` (về tối đa 4); mèo đặt sẵn của giống bị bỏ được tô lại thành giống còn giữ (không được tạo cụm gom sẵn, không có màu hợp thì thành ô trống) | thêm giống tới khi đủ 5 |
| Crate | đổi mọi `X` thành `.` | dùng bản biến thể đã vẽ sẵn (không sinh ngẫu nhiên) |
| Wall | đổi mọi `M` thành `.` | dùng bản biến thể đã vẽ sẵn |

**Thứ tự khi tắt** (từ ít thấy tới dễ thấy): moves → màu → crate → wall. Moves đổi thì người chơi gần như không nhận ra; wall thường là "bản sắc" của màn (Divided, Steel Fortress) nên tắt sau cùng.

**Thứ tự khi bật:** moves → màu. Crate và wall chỉ bật khi màn có sẵn bản biến thể vẽ tay, vì đặt vật cản ngẫu nhiên dễ làm bàn vô nghiệm hoặc xấu.

## 5. Luật an toàn

1. **Không đụng element mà màn đang dạy** (`introduces: 'crate'` thì không bao giờ tắt crate; màn có `tutorial` không chỉnh).
2. **Mỗi lần chỉ đổi tối đa 1 element** giữa hai lần thử liên tiếp (riêng P1 được hạ thẳng), tránh cảm giác màn đổi đột ngột.
3. **Boss không xuống dưới Medium**, kể cả ở P1; giữ nhãn boss trên bản đồ.
4. **Có độ trễ khi đổi profile:** cần 2 tín hiệu liên tiếp mới đổi (trừ P1 chuyển ngay), để một ván thua do bất cẩn không làm hệ thống phản ứng thái quá.
5. **Ẩn với người chơi:** bảng vào màn hiển thị nhãn của bản đang chơi (Easy/Medium/Hard), không hiện chữ "đã giảm độ khó".
6. **Sao và xu** tính theo `moves` của bản đang chơi (`starsFor` đã dùng `level.moves`), nên không cần đổi.
7. **Bảng xếp hạng điểm (nếu có):** điểm từ bản đã nới không công bằng với bản gốc. Hoặc chỉ xếp hạng bản gốc, hoặc ghi kèm nhãn độ khó.
8. **Kiểm chứng bằng bot:** mỗi biến thể (gốc −2, −1, +1, +2) phải chạy `simulate-levels.mjs` và đúng thứ tự tỉ lệ thắng (−2 > −1 > gốc > +1 > +2). Biến thể nào đảo thứ tự thì bỏ.

## 6. Mã giả

```js
// Sau mỗi lần thử: ghi metric, xác định profile, tính số element cho lần chơi tới.
function nextLevelPlan(history, levelIndex) {
  const p = detectProfile(history);                 // P0..P8, theo thứ tự ưu tiên mục 3
  const base = LEVELS[levelIndex];
  const baseCount = countElements(base);           // 0..4 theo bảng mục 1
  let shift = PROFILE_SHIFT[p](history);           // ví dụ P2: -min(2, loseStreak - 1)
  shift = clampOneStep(shift, history.lastShift);  // luật 2
  let target = clamp(baseCount + shift, 0, 4);
  if (base.tier === 'boss') target = Math.max(target, 2);  // luật 3
  return buildVariant(base, target);               // bật/tắt theo thứ tự mục 4, bỏ qua element đang dạy
}
```

Chỗ tích hợp dự kiến khi duyệt xong: module mới `game/adaptive.mjs` (thuần logic, test được bằng Node), save key mới `gomgom-rotate-profile-v1` trong `save.mjs`, `createSession` nhận bản biến thể thay vì `LEVELS[i]`, và `gom-gom.js` gửi thêm `thinkMs` / `idleMs` / `resultDwellMs` (đã có sẵn timer AFK).

## 7. Các quyết định đã chốt khi tích hợp

1. Ngưỡng giữ như đề xuất: moves bật từ 18 điểm/lượt, màu bật từ 5 giống. Mọi ngưỡng nằm ở `tuning.mjs` (`ADAPTIVE`).
2. Thứ tự màn 1→20 giữ nguyên trên bản đồ; chỉ độ khó của từng màn thay đổi. "Hàng đợi 5 màn" ở mục 3 là kết quả mong đợi khi chơi tiếp, không phải xếp lại thứ tự màn.
3. Màn 20 giữ 22 lượt (chưa cắt).
4. P3 (sát nút) giữ độ khó như thiết kế.
5. Màn có `tutorial` (1, 2, 5, 8) luôn chơi bản gốc.

## 8. Khác với thiết kế ban đầu

| Chỗ | Thiết kế | Bản cài | Lý do |
|---|---|---|---|
| Bật moves | `floor(target / 19)` | `floor(target / 18)` | Mô phỏng: 19 làm Divided rớt từ 68% xuống 9%, Tea Break từ 99% xuống 27% chỉ vì +1 element |
| Bỏ màu | Mèo của giống bị bỏ thành ô trống | Tô lại thành giống còn giữ | Xoá mèo làm bàn mất sẵn các cặp, nên bản "dễ hơn" lại thắng ít hơn (Garden Fortress, Steel Corners) |
| Ưu tiên P1/P3 | Sắp bỏ xét trước sát nút | Sát nút xét trước, tới lần chơi lại thứ 5 | Thua sát nút 4 lần liền cũng là thua ≥ 4 nên luôn rơi vào P1; như vậy luật "lần thứ 4 chỉ +2 lượt" của P3 không bao giờ chạy |
| P6 sau màn đổi loại | Lên Hard | +1 element | Luật "mỗi lần đổi tối đa 1 element" |
| Bản đồ | Chưa nói | Chỉ màn đang mở hiện nhãn đã chỉnh; các màn khác hiện nhãn gốc | Cả bản đồ đổi sang Easy khi đang thua thì người chơi thấy rõ game đang hạ độ khó |
| Quà P1 | 1 booster | 1 booster +3 lượt, hiện ở bảng thắng | |

Bỏ ngang chỉ tính khi đã đặt ít nhất một thẻ rồi bấm chơi lại hoặc về Home (mở màn rồi thoát ngay không tính).

## 9. Kiểm chứng bằng bot

`node tools/simulate-levels.mjs 20 --dda`: tỉ lệ thắng của bot tham lam (200 ván mỗi bản) theo số element, `*` = bản gốc. Mọi màn đều đúng thứ tự (ít element thắng nhiều hơn, sai số 5 điểm).

```
 3. Go Big           0*: 95%  1: 84%  2: 56%
 4. Triple Cards     0:100%  1*: 92%  2: 61%
 6. Crate Garden     0:100%  1: 99%  2*: 82%  3: 68%
 7. Tight Crates     0:100%  1: 97%  2*: 70%  3: 38%
 9. Iron & Oak       0: 97%  1: 96%  2: 96%  3: 91%  4*: 56%
10. Garden Fortress  0:100%  1:100%  2:100%  3: 92%  4*: 47%
11. Fresh Start      0: 97%  1*: 93%  2: 77%
12. Crate Scatter    0: 95%  1: 96%  2*: 93%  3: 59%
13. Steel Corners    0: 99%  1:100%  2: 98%  3*: 86%
14. Crate & Steel    0: 93%  1: 95%  2: 89%  3*: 75%  4: 57%
15. Open Field       0:100%  1:100%  2*: 84%
16. Crate Maze       0: 97%  1: 95%  2*: 76%  3: 39%
17. Divided          0: 92%  1: 93%  2*: 68%  3: 24%
18. Iron Gate        0: 95%  1: 98%  2: 96%  3: 75%  4*: 21%
19. Tea Break        0: 98%  1*: 99%  2: 45%  3: 31%
20. Steel Fortress   0: 72%  1: 77%  2: 72%  3*: 48%  4: 33%
```

Cần theo dõi: bước +1 ở Divided (68% → 24%) và Tea Break (99% → 45%) vẫn mạnh. Bot chỉ nhìn 1 nước nên người chơi giỏi sẽ thắng nhiều hơn, nhưng nếu dữ liệu thật cho thấy cao thủ hay thua ngay sau khi được tăng khó thì nên nới `TIGHTEN_PPM` hoặc chỉ cho tăng bằng màu ở hai màn này.

## 10. QA

Thêm `?dda` vào URL (ví dụ `http://localhost:<port>/?dda`): bảng vào màn hiện profile đang nhận diện, mức đổi và số element (ví dụ `Level 18 · frustrated -3 (4→1)`). Không có `?dda` thì người chơi chỉ thấy nhãn Easy / Medium / Hard / Boss. Xoá key `gomgom-rotate-profile-v1` trong localStorage để về người chơi mới.

## 11. Mô phỏng theo kiểu người chơi (01/10/2026)

`npm run simulate:profiles` (`tools/simulate-profiles.mjs`): 8 kiểu người chơi, mỗi kiểu 100 người ảo, đi hết 20 màn với màn cố định rồi với độ khó thích ứng. Người ảo là bot (`tools/bot.mjs`) có tay nghề riêng (độ lóng ngóng, có biết dùng Hold không) và hành vi riêng (thời gian nghĩ, AFK, bỏ ngang, đứng ở bảng kết quả, nghỉ 4 ngày). Thua thì chơi lại; **bỏ game** khi thua liên tiếp quá sức chịu (3 đến 10 lần tuỳ kiểu), riêng kiểu "dễ chán" bỏ game khi thắng ngay lần đầu 6 màn liền. Đây là mô hình giả định để so hai chế độ trên cùng người chơi, không phải dự báo số liệu thật.

Mỗi ô là `cố định → thích ứng`.

### 11.1 Bản đầu

| Kiểu người chơi | Qua hết 20 màn | Bỏ game (nản) | Bỏ game (chán) | Màn qua TB | Tỉ lệ thắng / lần thử | Lần thử / màn | Chuỗi thua dài nhất TB | Thua sát nút / lần thua |
|---|---|---|---|---|---|---|---|---|
| Người mới, chơi yếu | 1% → **86%** | 99% → **14%** | 0% → **0%** | 9.8 → **19.5** | 45% → **52%** | 2.2 → **1.9** | 6.0 → **4.2** | 41% → **45%** |
| Chơi trung bình | 69% → **100%** | 31% → **0%** | 0% → **0%** | 18.6 → **20.0** | 59% → **67%** | 1.7 → **1.5** | 5.3 → **3.0** | 64% → **67%** |
| Chơi khá (hay thua sát nút) | 68% → **100%** | 32% → **0%** | 0% → **0%** | 18.6 → **20.0** | 63% → **69%** | 1.6 → **1.4** | 5.1 → **3.0** | 67% → **73%** |
| Cao thủ | 95% → **100%** | 5% → **0%** | 0% → **0%** | 19.9 → **20.0** | 69% → **73%** | 1.4 → **1.4** | 3.9 → **2.7** | 73% → **74%** |
| Dễ nản, hay bỏ ngang | 0% → **2%** | 100% → **98%** | 0% → **0%** | 7.1 → **9.7** | 59% → **57%** | 1.7 → **1.7** | 3.0 → **3.0** | 52% → **49%** |
| Cao thủ dễ chán | 13% → **16%** | 1% → **0%** | 86% → **84%** | 9.2 → **9.3** | 81% → **83%** | 1.2 → **1.2** | 0.8 → **0.7** | 78% → **77%** |
| Suy nghĩ kỹ | 87% → **100%** | 13% → **0%** | 0% → **0%** | 19.5 → **20.0** | 67% → **73%** | 1.5 → **1.4** | 4.2 → **2.9** | 71% → **75%** |
| Quay lại sau 4 ngày nghỉ | 13% → **96%** | 87% → **4%** | 0% → **0%** | 13.9 → **19.9** | 49% → **59%** | 2.0 → **1.7** | 5.7 → **3.5** | 49% → **53%** |

| Kiểu người chơi | Easy / Medium / Hard (cố định) | Easy / Medium / Hard (thích ứng) | Profile nhận diện nhiều nhất | Quà / người |
|---|---|---|---|---|
| Người mới, chơi yếu | 34% / 39% / 28% | 39% / 51% / 10% | steady 39%, struggling 29%, onboarding 13% | 0.7 |
| Chơi trung bình | 26% / 44% / 30% | 31% / 50% / 19% | steady 50%, onboarding 15%, tutorial 14% | 0.3 |
| Chơi khá (hay thua sát nút) | 27% / 42% / 31% | 31% / 49% / 20% | steady 50%, onboarding 16%, tutorial 14% | 0.2 |
| Cao thủ | 29% / 44% / 27% | 32% / 48% / 20% | steady 52%, onboarding 17%, tutorial 15% | 0.1 |
| Dễ nản, hay bỏ ngang | 53% / 33% / 14% | 49% / 37% / 14% | steady 31%, onboarding 28%, tutorial 24% | 0.0 |
| Cao thủ dễ chán | 53% / 32% / 15% | 54% / 34% / 11% | onboarding 32%, steady 30%, tutorial 30% | 0.0 |
| Suy nghĩ kỹ | 28% / 43% / 29% | 32% / 48% / 20% | thinker 45%, onboarding 16%, tutorial 15% | 0.2 |
| Quay lại sau 4 ngày nghỉ | 27% / 44% / 29% | 36% / 49% / 15% | steady 41%, struggling 22%, onboarding 14% | 0.3 |

Bốn vấn đề: (1) nhánh tăng khó gần như không chạy, profile "skilled" chỉ 0–4% lần thử vì đòi ≥ 2 sao mỗi màn; (2) người dễ nản bỏ game ở lần thua thứ 3 trong khi P1 bật từ lần thứ 4; (3) người dễ chán bỏ game quanh màn 8–9 khi vẫn đang trong giai đoạn người mới; (4) điều kiện "chơi chán" đòi 3 màn liền 3 sao.

### 11.2 Bản sửa

Thay đổi: P4/P6 tính theo "thắng ngay lần đầu 3 màn liền" thay vì số sao; giai đoạn người mới rút còn 4 màn / 6 lần thử và vẫn cho tăng khó khi thắng sạch; P1 bật sớm hơn (thua 3 + dấu hiệu nản, bỏ ngang sau khi thua); thêm "người chơi mong manh" (từng bỏ ngang gần đây: thua 1 lần đã nới, thua 2 lần về Easy, không giữ độ khó khi thua sát nút). Đã thử và bỏ luật "2 lần liền thua rất xa (< 50% điểm) = sắp bỏ game" vì không đổi kết quả nào.

| Kiểu người chơi | Qua hết 20 màn | Bỏ game (nản) | Bỏ game (chán) | Màn qua TB | Tỉ lệ thắng / lần thử | Lần thử / màn | Chuỗi thua dài nhất TB | Thua sát nút / lần thua |
|---|---|---|---|---|---|---|---|---|
| Người mới, chơi yếu | 1% → **88%** | 99% → **12%** | 0% → **0%** | 9.8 → **19.5** | 45% → **53%** | 2.2 → **1.9** | 6.0 → **3.9** | 41% → **46%** |
| Chơi trung bình | 69% → **100%** | 31% → **0%** | 0% → **0%** | 18.6 → **20.0** | 59% → **64%** | 1.7 → **1.6** | 5.3 → **3.1** | 64% → **65%** |
| Chơi khá (hay thua sát nút) | 68% → **99%** | 32% → **1%** | 0% → **0%** | 18.6 → **20.0** | 63% → **65%** | 1.6 → **1.5** | 5.1 → **3.2** | 67% → **69%** |
| Cao thủ | 95% → **100%** | 5% → **0%** | 0% → **0%** | 19.9 → **20.0** | 69% → **70%** | 1.4 → **1.4** | 3.9 → **2.9** | 73% → **69%** |
| Dễ nản, hay bỏ ngang | 0% → **9%** | 100% → **91%** | 0% → **0%** | 7.1 → **10.7** | 59% → **57%** | 1.7 → **1.7** | 3.0 → **2.9** | 52% → **49%** |
| Cao thủ dễ chán | 13% → **40%** | 1% → **0%** | 86% → **60%** | 9.2 → **13.1** | 81% → **76%** | 1.2 → **1.3** | 0.8 → **1.4** | 78% → **74%** |
| Suy nghĩ kỹ | 87% → **100%** | 13% → **0%** | 0% → **0%** | 19.5 → **20.0** | 67% → **72%** | 1.5 → **1.4** | 4.2 → **3.0** | 71% → **72%** |
| Quay lại sau 4 ngày nghỉ | 13% → **97%** | 87% → **3%** | 0% → **0%** | 13.9 → **19.9** | 49% → **60%** | 2.0 → **1.7** | 5.7 → **3.3** | 49% → **53%** |

| Kiểu người chơi | Easy / Medium / Hard (cố định) | Easy / Medium / Hard (thích ứng) | Profile nhận diện nhiều nhất | Quà / người |
|---|---|---|---|---|
| Người mới, chơi yếu | 34% / 39% / 28% | 42% / 50% / 8% | steady 40%, struggling 22%, tutorial 12% | 2.1 |
| Chơi trung bình | 26% / 44% / 30% | 28% / 52% / 20% | steady 45%, skilled 16%, tutorial 13% | 0.3 |
| Chơi khá (hay thua sát nút) | 27% / 42% / 31% | 27% / 52% / 20% | steady 44%, skilled 18%, tutorial 13% | 0.3 |
| Cao thủ | 29% / 44% / 27% | 28% / 50% / 22% | steady 42%, skilled 23%, tutorial 14% | 0.2 |
| Dễ nản, hay bỏ ngang | 53% / 33% / 14% | 45% / 42% / 12% | steady 35%, tutorial 22%, struggling 16% | 0.3 |
| Cao thủ dễ chán | 53% / 32% / 15% | 39% / 45% / 16% | steady 42%, tutorial 21%, bored 17% | 0.0 |
| Suy nghĩ kỹ | 28% / 43% / 29% | 28% / 52% / 19% | thinker 33%, skilled 26%, tutorial 14% | 0.2 |
| Quay lại sau 4 ngày nghỉ | 27% / 44% / 29% | 36% / 49% / 14% | steady 42%, struggling 18%, tutorial 12% | 1.3 |

### 11.3 Nhận xét bản sửa

1. **Cao thủ được tăng khó thật:** profile "skilled" từ 3% lên 16–26% lần thử ở người chơi trung bình trở lên; tỉ lệ thắng của cao thủ gần như giữ nguyên (69% → 70%) thay vì tăng.
2. **Người dễ chán ở lại lâu hơn:** bỏ game vì chán 86% → 60%, qua hết 20 màn 13% → 40%.
3. **Các kiểu được nới vẫn giữ kết quả tốt:** người yếu bỏ game 99% → 12%, người quay lại sau nghỉ 87% → 3%.
4. **Người dễ nản vẫn khó cứu (bỏ game 100% → 91%):** trong mô hình họ chỉ để lộ dấu hiệu (bỏ ngang, nghĩ lâu) ở lần thua thứ 2, tức ngay trước khi bỏ game. Luật "mong manh" chỉ giúp những người đã từng bỏ ngang trước đó. Muốn cứu nhóm này phải nới ngay sau lần thua đầu cho mọi người chơi, và như vậy sẽ làm game dễ đi với tất cả các kiểu khác.
5. **Cao thủ vẫn chơi ít màn Hard hơn bản cố định (27% → 22%):** khi tăng khó, game chỉ bật được moves và màu, không tự thêm crate/wall, nên màn thiếu vật cản không lên được Hard; còn khi thua ở màn Hard thì vẫn bị nới. Muốn đổi điều này cần vẽ tay thêm bản có vật cản cho từng màn.

## 12. Chỉnh bộ chia thẻ khi chơi lại một màn (01/10/2026)

Trước đây bộ chia thẻ chỉ đổi gián tiếp (khi bớt giống mèo). Giờ `tuneDealer` trong `adaptive.mjs` chỉnh thêm tỉ lệ hình thẻ (`shapes`) và `assist` theo **lý do thua liên tiếp ở chính màn đang chơi lại**. Bàn và số lượt không đổi, nên người chơi khó nhận ra. Màn có tutorial vẫn không đổi.

| Tình huống | Chỉnh | Ngưỡng (`tuning.mjs`) |
|---|---|---|
| Thua vì hết chỗ ≥ 2 lần ở màn này | +2 thẻ đôi mỗi lần thua thêm (tối đa +4) | `STUCK_AFTER` |
| Thua vì hết lượt ≥ 2 lần ở màn này | +1 thẻ 3 ô, assist +0.1 mỗi lần thua thêm (tối đa 0.6) | `MOVES_AFTER`, `ASSIST_STEP`, `ASSIST_MAX` |
| Profile cao thủ (chưa thua ở màn này) | +1 thẻ đơn, assist −0.1 (tối thiểu 0.2) | `ASSIST_MIN` |

### 12.1 Vì sao không dùng "thẻ nhỏ khi hết chỗ"

Đề xuất ban đầu là cho thêm thẻ đơn khi người chơi hết chỗ. Đo bằng bot trên 14 màn không có tutorial (200 ván mỗi màn) cho thấy game thắng theo điểm nên **thẻ to dễ hơn, thẻ nhỏ khó hơn** (mỗi lượt đặt ít mèo thì ít điểm):

| Chỉnh bộ thẻ | Người yếu: thắng / kẹt | Dễ nản: thắng / kẹt | Cao thủ: thắng / kẹt |
|---|---|---|---|
| Gốc | 30% / 10% | 35% / 8% | 70% / 0.6% |
| Thẻ nhỏ (đơn +2, đôi +1, 3 ô −1) | 16% / 3% | 19% / 2% | 48% / 0% |
| Thẻ đôi +2 | 37% / 10% | 42% / 9% | 79% / 0.8% |
| Thẻ 3 ô +1 | 39% / 16% | 43% / 14% | 79% / 1.9% |
| Thẻ 3 ô +1, assist +0.1 | 43% / 15% | 47% / 13% | 82% / 1.7% |
| Thẻ đơn +1, assist −0.1 | 23% / 9% | 26% / 8% | 60% / 0.4% |

Thẻ nhỏ đúng là giảm kẹt, nhưng làm tỉ lệ thắng còn một nửa. Vì vậy hết chỗ thì cho thêm thẻ đôi (thắng nhiều hơn mà không kẹt thêm), hết lượt thì thêm thẻ 3 ô và assist, còn cao thủ thì siết bằng thẻ đơn và bớt assist. Lần thử đầu tiên với cao thủ (bớt assist + thêm thẻ 3 ô) đã làm cao thủ **dễ thắng hơn** (70% → 76%), nên đã bỏ.

### 12.2 Mô phỏng người chơi sau khi chỉnh bộ thẻ

| Kiểu người chơi | Qua hết 20 màn | Bỏ game (nản) | Bỏ game (chán) | Màn qua TB | Tỉ lệ thắng / lần thử | Lần thử / màn | Chuỗi thua dài nhất TB | Thua sát nút / lần thua |
|---|---|---|---|---|---|---|---|---|
| Người mới, chơi yếu | 1% → **99%** | 99% → **1%** | 0% → **0%** | 9.8 → **19.9** | 45% → **54%** | 2.2 → **1.9** | 6.0 → **3.4** | 41% → **42%** |
| Chơi trung bình | 69% → **100%** | 31% → **0%** | 0% → **0%** | 18.6 → **20.0** | 59% → **64%** | 1.7 → **1.6** | 5.3 → **2.7** | 64% → **63%** |
| Chơi khá (hay thua sát nút) | 68% → **100%** | 32% → **0%** | 0% → **0%** | 18.6 → **20.0** | 63% → **67%** | 1.6 → **1.5** | 5.1 → **2.7** | 67% → **66%** |
| Cao thủ | 95% → **100%** | 5% → **0%** | 0% → **0%** | 19.9 → **20.0** | 69% → **70%** | 1.4 → **1.4** | 3.9 → **2.5** | 73% → **69%** |
| Dễ nản, hay bỏ ngang | 0% → **18%** | 100% → **82%** | 0% → **0%** | 7.1 → **11.6** | 59% → **58%** | 1.7 → **1.7** | 3.0 → **2.8** | 52% → **45%** |
| Cao thủ dễ chán | 13% → **38%** | 1% → **0%** | 86% → **62%** | 9.2 → **13.1** | 81% → **77%** | 1.2 → **1.3** | 0.8 → **1.3** | 78% → **72%** |
| Suy nghĩ kỹ | 87% → **100%** | 13% → **0%** | 0% → **0%** | 19.5 → **20.0** | 67% → **71%** | 1.5 → **1.4** | 4.2 → **2.5** | 71% → **72%** |
| Quay lại sau 4 ngày nghỉ | 13% → **100%** | 87% → **0%** | 0% → **0%** | 13.9 → **20.0** | 49% → **59%** | 2.0 → **1.7** | 5.7 → **3.1** | 49% → **49%** |

| Kiểu người chơi | Easy / Medium / Hard (cố định) | Easy / Medium / Hard (thích ứng) | Thua vì hết chỗ / lần thua | Lần thử có chỉnh bộ thẻ | Profile nhận diện nhiều nhất | Quà / người |
|---|---|---|---|---|---|---|
| Người mới, chơi yếu | 34% / 39% / 28% | 40% / 51% / 9% | 14% → **14%** | 24% | steady 42%, struggling 23%, tutorial 12% | 1.8 |
| Chơi trung bình | 26% / 44% / 30% | 28% / 53% / 19% | 3% → **3%** | 25% | steady 48%, skilled 15%, tutorial 13% | 0.1 |
| Chơi khá (hay thua sát nút) | 27% / 42% / 31% | 28% / 51% / 21% | 3% → **3%** | 25% | steady 47%, skilled 17%, tutorial 14% | 0.1 |
| Cao thủ | 29% / 44% / 27% | 28% / 49% / 23% | 3% → **3%** | 25% | steady 47%, skilled 20%, tutorial 14% | 0.1 |
| Dễ nản, hay bỏ ngang | 53% / 33% / 14% | 44% / 44% / 12% | 5% → **6%** | 18% | steady 37%, tutorial 20%, struggling 17% | 0.4 |
| Cao thủ dễ chán | 53% / 32% / 15% | 40% / 44% / 17% | 2% → **3%** | 8% | steady 42%, tutorial 21%, bored 17% | 0.0 |
| Suy nghĩ kỹ | 28% / 43% / 29% | 28% / 52% / 20% | 2% → **2%** | 29% | thinker 36%, skilled 24%, tutorial 14% | 0.0 |
| Quay lại sau 4 ngày nghỉ | 27% / 44% / 29% | 36% / 49% / 15% | 12% → **15%** | 22% | steady 43%, struggling 19%, tutorial 12% | 1.3 |

So với mục 11.2 (chưa chỉnh bộ thẻ): người yếu bỏ game 12% → 1%, người dễ nản 91% → 82%, người quay lại sau nghỉ 3% → 0%; cao thủ vẫn thắng 70% mỗi lần thử (không bị dễ đi), và tỉ lệ màn Hard của cao thủ 22% → 23%. Khoảng 25% số lần thử của người chơi trung bình có chỉnh bộ thẻ.

## 13. Kiểm thử theo từng màn 1–20 (01/10/2026)

`node tools/simulate-profiles.mjs 100 --levels`: 8 kiểu × 100 người, chơi liên tiếp màn 1 → 20 ở mỗi chế độ.

### 13.1 Hai lỗi tìm ra và đã sửa trong lần chạy này

| Lỗi | Biểu hiện | Sửa |
|---|---|---|
| Màn tutorial được tính vào chuỗi thắng | Màn 1, 2 ai cũng thắng, nên thắng màn 3 là đủ "3 màn sạch" → màn 4 bị tăng khó với **mọi** người: thắng ngay lần đầu 80% → 40%, nhóm yếu 67% → 27% | Chuỗi thắng bỏ qua màn tutorial |
| Thắng liền mấy màn Easy cũng thành "cao thủ" | Màn 11 (Easy) + 12, 13 → màn 14 bị tăng khó, thắng ngay lần đầu 62% → 47% | Cao thủ chỉ tính màn thắng ở mức Medium trở lên (lần thử lưu thêm `count`) |

Sửa xong thì người dễ chán bỏ game trở lại 83%. Kết quả "đỡ chán" ở mục 12 thật ra đến từ lỗi màn 4 tăng khó với mọi người. Vì vậy "chơi chán" giờ được nhận sau 2 màn thắng sạch (thay vì 3), nhưng vẫn phải có dấu hiệu lơ đãng: bỏ game vì chán 83% → 64%, các kiểu khác không đổi.

### 13.2 Kết quả bản cuối

| Kiểu người chơi | Qua hết 20 màn | Bỏ game (nản) | Bỏ game (chán) | Màn qua TB | Tỉ lệ thắng / lần thử | Lần thử / màn | Chuỗi thua dài nhất TB | Thua sát nút / lần thua |
|---|---|---|---|---|---|---|---|---|
| Người mới, chơi yếu | 1% → **98%** | 99% → **2%** | 0% → **0%** | 9.8 → **19.8** | 45% → **54%** | 2.2 → **1.8** | 6.0 → **3.5** | 41% → **45%** |
| Chơi trung bình | 69% → **100%** | 31% → **0%** | 0% → **0%** | 18.6 → **20.0** | 59% → **68%** | 1.7 → **1.5** | 5.3 → **2.7** | 64% → **64%** |
| Chơi khá (hay thua sát nút) | 68% → **100%** | 32% → **0%** | 0% → **0%** | 18.6 → **20.0** | 63% → **69%** | 1.6 → **1.5** | 5.1 → **2.7** | 67% → **71%** |
| Cao thủ | 95% → **100%** | 5% → **0%** | 0% → **0%** | 19.9 → **20.0** | 69% → **72%** | 1.4 → **1.4** | 3.9 → **2.4** | 73% → **72%** |
| Dễ nản, hay bỏ ngang | 0% → **16%** | 100% → **84%** | 0% → **0%** | 7.1 → **11.8** | 59% → **60%** | 1.7 → **1.7** | 3.0 → **2.8** | 52% → **48%** |
| Cao thủ dễ chán | 13% → **36%** | 1% → **0%** | 86% → **64%** | 9.2 → **12.3** | 81% → **77%** | 1.2 → **1.3** | 0.8 → **1.1** | 78% → **75%** |
| Suy nghĩ kỹ | 87% → **100%** | 13% → **0%** | 0% → **0%** | 19.5 → **20.0** | 67% → **73%** | 1.5 → **1.4** | 4.2 → **2.6** | 71% → **73%** |
| Quay lại sau 4 ngày nghỉ | 13% → **100%** | 87% → **0%** | 0% → **0%** | 13.9 → **20.0** | 49% → **61%** | 2.0 → **1.6** | 5.7 → **3.1** | 49% → **53%** |

| Kiểu người chơi | Easy / Medium / Hard (cố định) | Easy / Medium / Hard (thích ứng) | Thua vì hết chỗ / lần thua | Lần thử có chỉnh bộ thẻ | Profile nhận diện nhiều nhất | Quà / người |
|---|---|---|---|---|---|---|
| Người mới, chơi yếu | 34% / 39% / 28% | 41% / 50% / 9% | 14% → **13%** | 20% | steady 45%, struggling 23%, tutorial 12% | 1.8 |
| Chơi trung bình | 26% / 44% / 30% | 31% / 51% / 18% | 3% → **3%** | 17% | steady 51%, tutorial 14%, struggling 12% | 0.1 |
| Chơi khá (hay thua sát nút) | 27% / 42% / 31% | 30% / 49% / 21% | 3% → **3%** | 17% | steady 52%, tutorial 14%, onboarding 10% | 0.1 |
| Cao thủ | 29% / 44% / 27% | 31% / 49% / 20% | 3% → **3%** | 16% | steady 52%, tutorial 14%, onboarding 11% | 0.0 |
| Dễ nản, hay bỏ ngang | 53% / 33% / 14% | 48% / 40% / 13% | 5% → **6%** | 10% | steady 40%, tutorial 20%, struggling 18% | 0.4 |
| Cao thủ dễ chán | 53% / 32% / 15% | 43% / 40% / 18% | 2% → **4%** | 7% | steady 38%, tutorial 22%, bored 16% | 0.0 |
| Suy nghĩ kỹ | 28% / 43% / 29% | 31% / 49% / 20% | 2% → **4%** | 19% | thinker 43%, tutorial 15%, skilled 12% | 0.1 |
| Quay lại sau 4 ngày nghỉ | 27% / 44% / 29% | 37% / 49% / 14% | 12% → **15%** | 15% | steady 47%, struggling 18%, tutorial 13% | 1.1 |

### Theo từng màn (800 người mỗi chế độ, cố định → thích ứng)

| Màn | Tên | Nhãn gốc | Người tới màn | Thắng ngay lần đầu | Lần thử / người qua | Bỏ game tại màn (% người tới) | E/M/H thực chơi (thích ứng) | Element đổi TB | Có chỉnh bộ thẻ | Thua vì hết chỗ |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hello, Kitty (tutorial) | Easy | 800 → **800** | 100% → **100%** | 1.00 → **1.00** | 0% → **0%** | 100%/0%/0% | +0.00 | 0% | 0% → **0%** |
| 2 | Round and Round (tutorial) | Easy | 800 → **800** | 100% → **100%** | 1.00 → **1.00** | 0% → **0%** | 100%/0%/0% | +0.00 | 0% | 0% → **0%** |
| 3 | Go Big | Easy | 800 → **800** | 91% → **91%** | 1.10 → **1.10** | 0% → **0%** | 100%/0%/0% | +0.00 | 1% | 0% → **0%** |
| 4 | Triple Cards | Easy | 799 → **800** | 80% → **80%** | 1.26 → **1.24** | 1% → **0%** | 100%/0%/0% | +0.00 | 4% | 0% → **0%** |
| 5 | Crates (tutorial) | Easy | 793 → **799** | 93% → **93%** | 1.08 → **1.09** | 0% → **0%** | 100%/0%/0% | +0.00 | 0% | 0% → **0%** |
| 6 | Crate Garden | Medium | 792 → **798** | 69% → **66%** | 1.56 → **1.49** | 11% → **6%** | 5%/95%/0% | -0.05 | 10% | 0% → **0%** |
| 7 | Tight Crates | Medium | 702 → **749** | 55% → **57%** | 2.06 → **1.78** | 7% → **2%** | 16%/84%/0% | -0.16 | 13% | 16% → **19%** |
| 8 | Steel Nap (tutorial) | Easy | 652 → **732** | 96% → **95%** | 1.05 → **1.06** | 0% → **0%** | 100%/0%/0% | +0.00 | 0% | 0% → **0%** |
| 9 | Iron & Oak | Hard | 652 → **731** | 42% → **43%** | 2.51 → **2.06** | 9% → **3%** | 3%/13%/84% | -0.24 | 19% | 7% → **9%** |
| 10 | Garden Fortress | Boss | 595 → **710** | 33% → **43%** | 3.47 → **2.14** | 14% → **2%** | 0%/27%/73% | -0.35 | 30% | 9% → **10%** |
| 11 | Fresh Start | Easy | 509 → **697** | 86% → **84%** | 1.17 → **1.20** | 0% → **0%** | 95%/5%/0% | -0.29 | 8% | 0% → **0%** |
| 12 | Crate Scatter | Medium | 509 → **696** | 81% → **77%** | 1.27 → **1.34** | 1% → **1%** | 16%/84%/0% | -0.10 | 10% | 4% → **6%** |
| 13 | Steel Corners | Medium | 506 → **687** | 73% → **69%** | 1.41 → **1.43** | 1% → **1%** | 0%/100%/0% | -0.05 | 13% | 0% → **0%** |
| 14 | Crate & Steel | Medium | 502 → **679** | 62% → **56%** | 1.71 → **1.72** | 2% → **0%** | 3%/84%/13% | -0.01 | 21% | 8% → **9%** |
| 15 | Open Field | Medium | 494 → **678** | 73% → **69%** | 1.41 → **1.45** | 1% → **1%** | 14%/86%/0% | +0.10 | 26% | 0% → **0%** |
| 16 | Crate Maze | Medium | 488 → **674** | 67% → **55%** | 1.56 → **1.77** | 1% → **0%** | 15%/85%/0% | +0.09 | 29% | 1% → **1%** |
| 17 | Divided | Medium | 481 → **671** | 51% → **45%** | 2.19 → **1.97** | 5% → **1%** | 21%/79%/0% | -0.08 | 27% | 1% → **3%** |
| 18 | Iron Gate | Hard | 458 → **667** | 17% → **23%** | 5.65 → **2.84** | 24% → **2%** | 7%/33%/59% | -0.61 | 35% | 8% → **17%** |
| 19 | Tea Break | Easy | 350 → **653** | 95% → **92%** | 1.06 → **1.11** | 0% → **0%** | 94%/6%/0% | -0.52 | 6% | 0% → **0%** |
| 20 | Steel Fortress | Boss | 350 → **653** | 46% → **45%** | 2.28 → **2.02** | 1% → **0%** | 0%/99%/1% | -0.30 | 21% | 7% → **8%** |

### Thắng ngay lần đầu theo nhóm tay nghề (cố định → thích ứng)

| Màn | Yếu + dễ nản | Trung bình + khá + quay lại | Cao thủ + dễ chán + suy nghĩ kỹ |
|---|---|---|---|
| 1 | 100% → **100%** (200→200 người) | 100% → **100%** (300→300 người) | 100% → **100%** (300→300 người) |
| 2 | 100% → **100%** (200→200 người) | 100% → **100%** (300→300 người) | 100% → **100%** (300→300 người) |
| 3 | 83% → **83%** (200→200 người) | 91% → **91%** (300→300 người) | 95% → **95%** (300→300 người) |
| 4 | 67% → **68%** (199→200 người) | 81% → **81%** (300→300 người) | 88% → **88%** (300→300 người) |
| 5 | 81% → **82%** (193→199 người) | 96% → **95%** (300→300 người) | 98% → **98%** (300→300 người) |
| 6 | 50% → **51%** (192→198 người) | 69% → **68%** (300→300 người) | 80% → **73%** (300→300 người) |
| 7 | 32% → **39%** (172→195 người) | 58% → **59%** (300→300 người) | 68% → **67%** (230→254 người) |
| 8 | 85% → **88%** (127→178 người) | 97% → **97%** (295→300 người) | 99% → **99%** (230→254 người) |
| 9 | 18% → **22%** (127→177 người) | 45% → **47%** (295→300 người) | 52% → **53%** (230→254 người) |
| 10 | 18% → **53%** (82→157 người) | 31% → **37%** (285→300 người) | 43% → **45%** (228→253 người) |
| 11 | 63% → **65%** (32→145 người) | 85% → **89%** (251→300 người) | 90% → **89%** (226→252 người) |
| 12 | 50% → **48%** (32→144 người) | 76% → **83%** (251→300 người) | 90% → **87%** (226→252 người) |
| 13 | 45% → **57%** (31→143 người) | 71% → **68%** (251→300 người) | 79% → **77%** (224→244 người) |
| 14 | 48% → **41%** (29→139 người) | 55% → **55%** (251→300 người) | 71% → **65%** (222→240 người) |
| 15 | 30% → **59%** (23→138 người) | 68% → **66%** (249→300 người) | 82% → **79%** (222→240 người) |
| 16 | 36% → **45%** (22→136 người) | 62% → **52%** (249→300 người) | 76% → **66%** (217→238 người) |
| 17 | 12% → **27%** (17→135 người) | 41% → **44%** (249→300 người) | 66% → **57%** (215→236 người) |
| 18 | 0% → **20%** (7→131 người) | 14% → **26%** (237→300 người) | 22% → **21%** (214→236 người) |
| 19 | 0% → **85%** (1→117 người) | 95% → **93%** (153→300 người) | 95% → **94%** (196→236 người) |
| 20 | 0% → **35%** (1→117 người) | 38% → **44%** (153→300 người) | 52% → **50%** (196→236 người) |

## 14. Sửa mục 3 và 4 của báo cáo 13 (01/10/2026)

| Mục | Đã thử | Kết quả | Quyết định |
|---|---|---|---|
| 4. Màn 18 kẹt nhiều | Bàn có ≥ 6 ô vật cản (`CROWDED_BLOCKS`): hết lượt thì thêm 2 thẻ đôi thay vì 1 thẻ 3 ô | Đo riêng trên 10 màn chật: bot yếu thắng 30% (thẻ 3 ô: 31%), kẹt 12% (thẻ 3 ô: 21%). Trên bản màn Iron Gate, kẹt giảm 3–4 điểm ở mọi mức element | **Giữ** |
| 4. (phần còn lại) | Bớt crate trước khi thêm lượt cho người hay kẹt | Iron Gate: bot yếu hết kẹt (43% → 3%) nhưng thắng 11% → 6%; bot trung bình 56% → 19% | **Bỏ.** Kẹt tăng ở màn 18 là do bản được thêm lượt kéo dài ván trên bàn chật; tổng số lần thua vẫn giảm (1608 → 1122) |
| 3. Màn 6 bỏ game nhiều | Màn 6 thêm 1 lượt (14 → 15) | Bot yếu 43% → 60%. Nhưng người bỏ game tại màn 6 hầu hết là **người dễ chán** (46/51 ở bản 14 lượt), bỏ vì đó là màn thứ 6 thắng liền, không phải vì khó. Bản 15 lượt: người dễ nản bỏ tại màn 6 giảm 5 → 1, người dễ chán tăng 46 → 61, tổng bỏ game cả 20 màn 155 → 165 | **Hoàn lại 14 lượt.** Chẩn đoán "màn 6 quá khó" ở mục 13 là sai |
| (phụ) Chán ở màn Easy | Màn Easy bị nhận là "chơi chán" thì +1 element thay vì đổi loại | Bỏ game vì chán 75% → 77% (không đổi) | **Bỏ** |

Kết quả cuối (`node tools/simulate-profiles.mjs 100 --levels`) gần như trùng mục 13.2: người yếu bỏ game 2%, dễ nản 86%, dễ chán 66%, màn 18 thua vì hết chỗ 17% → 16%. Mục 4 có tác dụng thật nhưng nhỏ so với nhiễu của mô phỏng tổng.

Bài học: chỗ bỏ game cao ở màn 6 là vấn đề **người chơi giỏi thấy chán ở đầu game** (6 màn đầu có 3 tutorial không chỉnh được), không phải vấn đề độ khó của màn 6.

## 15. Tính booster vào thuật toán (01/10/2026) — ĐÃ HOÀN LẠI một phần, xem 15.4

Trước đây thuật toán chỉ biết tổng số booster mỗi lần thử, và chỉ dùng để không tính lần thắng có booster vào chuỗi thắng sạch.

### 15.1 Luật mới

| Luật | Chi tiết | Chỗ trong code |
|---|---|---|
| Ghi chi tiết | Mỗi lần thử lưu `boostUse { hammer, swap, moves }`, `bought` (mua bằng xu ngay trong ván), `preBoostRatio` (tỉ lệ điểm ngay trước lần +lượt đầu) | `gom-gom.js`: `haveBooster`, `useBooster`, nút +lượt, `recordTry` |
| 3 loại thắng | `clean` không booster · `assisted` 1 búa hoặc 1 đổi thẻ · `carried` có +lượt hoặc ≥ 2 booster (`CARRIED_BOOSTERS`) | `winKind` |
| Thắng nhờ booster | Vẫn qua màn, nhưng không xoá chuỗi thua và không tính vào chuỗi thắng, nên màn sau vẫn được nới | `detectProfile` |
| Thua sát nút | Tính theo `preBoostRatio`: điểm có được nhờ lượt mua thêm không tính | `ownRatio` |
| Thua dù đã dùng booster | Nặng gấp đôi khi xét "đang vật lộn" | `loseWeight`, `retryWeight` |
| Mua bằng xu mà vẫn thua | Sắp bỏ game (về Easy, có quà khi thắng lại) | `detectProfile` |
| Phụ thuộc booster | Từ 3 trong 5 lần thắng gần nhất là nhờ booster (`RELIANT_WINS`) thì bớt 1 element | profile `booster-reliant` |
| Không bao giờ tăng khó vì booster | Không luật nào đọc số booster đang có hay số xu | |
| **Giữ luật sát nút** | Giữ nguyên độ khó **và cả bộ thẻ** (trước đây bộ thẻ vẫn tự nới khi thua vì hết lượt); bảng thua ghi "So close! Try +3 moves next time." và nút +3 lượt nhấp nháy ở lần chơi lại. Nếu lần vừa rồi đã dùng booster thì không mời lại | `boosterTip`, `plan.suggestBooster`, CSS `.boost.suggest` |

### 15.2 Mô phỏng

Bot dùng +3 lượt khi còn 1 lượt mà đã đạt ngưỡng điểm, và đổi thẻ khi thẻ không vừa bàn (`tools/bot.mjs`, tham số `boost`). Mỗi người ảo bắt đầu với 3 booster mỗi loại, nhận 50 xu cho mỗi sao mới, hết booster thì mua tuỳ kiểu: người yếu mua ngay khi đủ xu; trung bình, khá, suy nghĩ kỹ, quay lại chỉ mua khi đủ xu cho 2 cái; cao thủ và người dễ nản không mua. Cao thủ chỉ dùng booster khi chơi lại màn đã thua. Ba chế độ: màn cố định / thích ứng không tính booster / **thích ứng có tính booster**.

| Kiểu người chơi | Bỏ game (nản) | Qua hết 20 màn | Booster dùng / người | Booster mua bằng xu / người | Lần thắng nhờ booster |
|---|---|---|---|---|---|
| Người mới, chơi yếu | 26% / 0% / **0%** | 74% / 100% / **100%** | 22.9 / 20.7 / **14.9** | 17.6 / 15.7 / **10.3** | 60% / 56% / **46%** |
| Chơi trung bình | 1% / 0% / **0%** | 99% / 100% / **100%** | 9.7 / 9.9 / **8.2** | 6.3 / 6.7 / **4.8** | 39% / 41% / **33%** |
| Chơi khá (hay thua sát nút) | 0% / 0% / **0%** | 100% / 100% / **100%** | 8.8 / 10.1 / **7.6** | 5.7 / 6.9 / **4.4** | 37% / 41% / **32%** |
| Cao thủ | 1% / 0% / **0%** | 99% / 100% / **100%** | 1.7 / 1.6 / **1.6** | 0.0 / 0.0 / **0.0** | 8% / 7% / **6%** |
| Dễ nản, hay bỏ ngang | 100% / 88% / **80%** | 0% / 12% / **20%** | 3.6 / 4.1 / **4.1** | 0.0 / 0.0 / **0.0** | 27% / 21% / **19%** |
| Cao thủ dễ chán | 0% / 0% / **0%** | 16% / 39% / **38%** | 0.4 / 0.7 / **0.7** | 0.0 / 0.0 / **0.0** | 3% / 5% / **5%** |
| Suy nghĩ kỹ | 0% / 0% / **0%** | 100% / 100% / **100%** | 7.6 / 8.3 / **6.8** | 4.5 / 5.2 / **3.7** | 33% / 36% / **29%** |
| Quay lại sau 4 ngày nghỉ | 11% / 0% / **0%** | 89% / 100% / **100%** | 13.6 / 12.3 / **10.5** | 9.1 / 8.1 / **6.4** | 47% / 44% / **39%** |

### 15.3 Nhận xét

1. **Booster tự nó đã làm game dễ đi rất nhiều.** Ở bản cố định, có booster thì người yếu bỏ game 26% (không có booster: 99%), và người yếu dùng khoảng 23 booster trên 20 màn (mua 18 cái bằng xu). Kinh tế booster hiện khá rộng rãi: 50 xu mỗi sao mới đủ mua gần 1 booster +3 lượt (80 xu) cho mỗi màn qua.
2. **Tính booster giúp người dễ nản:** bỏ game 88% → 80%, vì thắng nhờ booster không còn xoá chuỗi thua.
3. **Người chơi dùng booster ít hơn 20–35%** (người yếu 20.7 → 14.9, trung bình 9.9 → 8.2) và mua bằng xu ít hơn 30–35%, vì profile "phụ thuộc booster" nới màn để họ tự thắng được. Tỉ lệ thắng nhờ booster giảm (người yếu 56% → 46%).
4. **Ảnh hưởng tới kinh tế:** hiện booster chỉ mua bằng xu (Shop tiền thật vẫn "Coming soon"), nên điều này làm xu được tiêu cho booster ít đi và dư cho Deco nhiều hơn. Nếu sau này bán booster bằng tiền thật thì đây là đánh đổi doanh thu; chỉnh bằng `RELIANT_WINS` (tăng lên 4 hoặc 5 thì ít nới hơn).
5. **Profile "thua sát nút" gần như không còn xảy ra (0–3% lần thử)** khi người chơi có booster: những ván sát nút phần lớn đã được cứu bằng +3 lượt ngay trong ván.

### 15.4 Hoàn lại: booster không ảnh hưởng điều kiện thắng/thua (quyết định của chủ dự án)

Đã bỏ: 3 loại thắng (thắng nhờ booster không xoá chuỗi thua), thua có booster tính gấp đôi, mua bằng xu mà vẫn thua = sắp bỏ game, profile "phụ thuộc booster", sát nút tính theo điểm trước khi +lượt (`winKind`, `ownRatio`, `CARRIED_BOOSTERS`, `RELIANT_WINS`). Giờ **thắng có booster vẫn là thắng, thua có booster vẫn là một lần thua**.

Vẫn giữ (không đổi thắng/thua):
- Luật sát nút: giữ độ khó **và bộ thẻ**, bảng thua mời dùng +3 lượt, nút +3 lượt nhấp nháy ở lần chơi lại, không mời lại nếu lần vừa rồi đã dùng booster.
- Ghi `boostUse`, `bought`, `preBoostRatio` vào lần thử, chỉ để thống kê; thuật toán không đọc.
- Luật có từ trước: thắng có dùng booster không tính vào chuỗi thắng sạch (cao thủ / chơi chán).
- Bot dùng booster trong mô phỏng (cả hai chế độ).

Mô phỏng sau khi hoàn lại (`cố định → thích ứng`, người ảo có dùng booster):

| Kiểu người chơi | Bỏ game (nản) | Qua hết 20 màn | Booster dùng / người | Booster mua bằng xu / người | Lần thắng có dùng booster |
|---|---|---|---|---|---|
| Người mới, chơi yếu | 26% → **0%** | 74% → **100%** | 22.9 → **21.1** | 17.6 → **15.9** | 60% → **56%** |
| Chơi trung bình | 1% → **0%** | 99% → **100%** | 9.7 → **9.3** | 6.3 → **5.9** | 39% → **37%** |
| Chơi khá (hay thua sát nút) | 0% → **0%** | 100% → **100%** | 8.8 → **8.9** | 5.7 → **5.7** | 37% → **37%** |
| Cao thủ | 1% → **0%** | 99% → **100%** | 1.7 → **1.6** | 0.0 → **0.0** | 8% → **7%** |
| Dễ nản, hay bỏ ngang | 100% → **87%** | 0% → **13%** | 3.6 → **4.1** | 0.0 → **0.0** | 27% → **21%** |
| Cao thủ dễ chán | 0% → **0%** | 16% → **39%** | 0.4 → **0.7** | 0.0 → **0.0** | 4% → **5%** |
| Suy nghĩ kỹ | 0% → **0%** | 100% → **100%** | 7.6 → **7.5** | 4.5 → **4.4** | 33% → **32%** |
| Quay lại sau 4 ngày nghỉ | 11% → **0%** | 89% → **100%** | 13.6 → **12.2** | 9.1 → **7.8** | 48% → **44%** |

So với 15.2 (bản có tính booster): người dễ nản bỏ game 80% → 87%; người chơi dùng booster nhiều hơn (người yếu 14.9 → 21.1 mỗi người, mua bằng xu 10.3 → 15.9). Các kiểu khác gần như không đổi.

