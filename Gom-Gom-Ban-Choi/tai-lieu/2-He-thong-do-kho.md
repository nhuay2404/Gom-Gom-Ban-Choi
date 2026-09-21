# Gom Gom — Tài liệu độ khó (curve v2.1)

Tài liệu bảo trì cho hệ thống độ khó của hành trình 20 màn. Phần số liệu và chart nằm trong [report.md](report.md), được sinh tự động từ dữ liệu đóng băng; tài liệu này giải thích cơ chế, chỉ số, quy trình và lý do quyết định để người sau có thể chỉnh mà không phá vỡ.

Cập nhật lần cuối: 17/09/2026. Người biên soạn: Claude Code theo yêu cầu chủ dự án, dựa trên nghiên cứu game đang sống và số đo bằng bot trong dự án.

## 1. Vấn đề và kết luận

Bản đầu tiên neo ngân sách vào lời giải của solver nhân slack theo nhịp. Đo bằng bot không dùng hoàn tác: bot thắng 99 đến 100% mọi màn ở ngân sách cũ và 74 đến 98% ngay ở ngân sách tối thiểu. Chủ dự án chơi thật cũng thấy không đủ khó. Ba nguyên nhân, đúng thứ tự tác động:

1. Hoàn tác miễn phí không giới hạn và gợi ý mách đúng nước biến ngân sách thành không ràng buộc. Mọi game tile match, match-3 và solitaire theo màn đang sống đều giới hạn hoặc bán undo.
2. Bàn 20 ô không có trạng thái thua theo không gian: bàn kín chỉ đẩy thẻ lẻ về bộ bài với giá 1 lượt.
3. Layout không có bẫy nên đi tham lam một bước gần như tối ưu; ngân sách cắt bao nhiêu cũng không tạo ra quyết định.

Kết luận thiết kế: độ khó phải đến từ cấu trúc (độ lộ nguồn, ô trống rời rạc, choke point có chủ đích) và từ việc hỗ trợ có giá; ngân sách chỉ là núm tinh chỉnh cuối, đo bằng bot theo hai mức kỹ năng.

## 2. Cơ chế đang có

### 2.1 Luật áp lực theo màn (`PressureRules`, `src/engine.ts`)

| Luật | Giá trị ở màn hành trình | Ý nghĩa |
|---|---|---|
| `recycle` | `none` | **Không có bộ bài và khay rút.** Bàn kín mà chưa gom hết nhóm là ván kết thúc. Sáu màn mẫu QA giữ `collect` để bộ hồi quy còn nguyên cơ chế cũ. |
| `recycleCost` | `escalating` | Chỉ còn ý nghĩa cho màn mẫu: lần thu bài thứ n tốn n lượt. |
| `recycleTo` | `bottom` | Thẻ lẻ thu về nằm dưới đáy bộ bài, không quay lại ngay. |
| `missionRank` | ⌈G/2⌉, tối thiểu 2, null khi G = 2 | Thưởng +2 chỉ khi nhóm ưu tiên nằm trong N nhóm gom đầu. HUD mờ đi khi đã lỡ. |
| `cookieLimit` | 2, riêng màn Khó và Siêu khó là 1 | Bánh quy mỗi ván. |
| Đồng hồ | +5 lượt, một lần mỗi ván | Trước là +8. Chỉ được mời khi còn tối đa 2 nhóm. |

Sáu màn mẫu (id 1 đến 6) không có `rules` nên giữ luật cũ. State sao chép `rules` lúc tạo ván; đổi tuning không ảnh hưởng ván đang chơi.

### 2.1b Bỏ bộ bài và khay rút (18/09/2026)

Chủ dự án nhìn hàng bộ bài cùng ba khay rút và chốt bỏ hẳn: ba khay là chỗ giữ thẻ miễn phí không giới hạn, đúng chỗ rò rỉ độ khó lớn nhất còn lại, và cũng là lý do đo được rằng chôn thẻ chốt xuống đáy bộ bài lại làm màn **dễ hơn** với bot biết tính.

Hệ quả trong luật: hành trình 20 màn không còn `stock`, không còn khay, và vì thẻ lẻ không còn chỗ nào để về nên bàn kín là thua ngay. Hệ quả trong nội dung: chương 3 vốn tên "Thu và rút" đổi thành **"Bàn kín là thua"**; màn 11 dạy thu thẻ lẻ được dựng lại thành màn dạy giữ chỗ trống; màn 12, 13, 17, 18 dồn thẻ bộ bài vào các cột nguồn; hai bài hướng dẫn `collect`, `draw-trays`, `layered` bị thay bằng `board-full` và `space-warning`. Chương 2 đổi tên thành "Dời cả cụm" cho khỏi trùng ý với chương 3.

Vì tải thẻ tăng mà van xả mất, màn 17 và 18 phải giảm từ 7 nhóm xuống 6 nhóm, nếu không người chơi không tính trước sẽ bế tắc (đo được: bot thường thắng 13% và 25% ở bản 7 nhóm).

**Một hệ quả phải theo dõi:** thất bại đổi tính chất. Trước đây người chơi thua vì hết lượt ở đoạn cuối, cảm giác sát nút. Giờ có thêm kiểu thua sớm vì lấp kín bàn, không phải sát nút chút nào. Vì vậy bộ chỉ số near-miss tách làm hai: `stuckShare` đếm tỉ lệ thua vì bàn kín, còn "thiếu mấy lượt" chỉ tính trên các ván thua vì hết lượt. Cổng mới: màn có nhãn không được để quá 70% ván thua là do bàn kín, vì khi đó ngân sách lượt không còn ràng buộc gì.

### 2.2 Obstacle (`Obstacles`, curve v2.1)

- **Ô đá** (`holes`): ô không đặt thẻ. Hàng chứa ô đá tối đa 3 thẻ liền, nên bộ bốn phải ở hàng khác. `capacity = 20 − số ô đá`; bàn kín khi mọi ô còn lại có thẻ.
- **Cột khóa** (`lockedColumns`): cột nguồn không lấy được thẻ cho tới khi gom xong nhóm ghi trên khóa. Đây là choke point đặt tay: đặt thẻ cần cho một trong các bộ cuối vào cột khóa, chìa khóa là nhóm tự nhiên hoàn thành ở giữa đường đi.

Obstacle là dữ liệu trên `LevelSpec.obstacles`; engine, solver, bot, `layoutStats` và test đều hiểu. Tutorial `hole` và `locked-column` tự gắn vào màn có obstacle. Màn thua liệt kê nguyên nhân: hết lượt còn mấy nhóm, cột nào còn khóa vì chưa gom gì, đã thu bài mấy lần tốn mấy lượt, ô đá làm hàng nào chỉ còn ba ô, thưởng ưu tiên đã lỡ hay chưa.

Không dùng: thẻ úp mặt và chôn thẻ chốt dưới đáy bộ bài. Đo 34 biến thể cho thấy chúng làm màn dễ hơn với bot giỏi vì ba lần rút đầu đưa thẻ chốt lên khay, và khay là vùng giữ miễn phí; đồng thời thứ tự ẩn bị nhớ sau một lần chơi.

### 2.3 Hỗ trợ có giá (`src/tuning.ts`)

| Nhịp | Hoàn tác miễn phí | Hoàn tác có phí | Gợi ý miễn phí | Gợi ý có phí |
|---|---:|---:|---:|---:|
| Học | 3 | 3 | 2 | 2 |
| Luyện | 3 | 3 | 1 | 2 |
| Kết hợp | 2 | 3 | 1 | 2 |
| Thử thách nhẹ | 2 | 3 | 1 | 2 |
| Thử thách (Khó) | 1 | 2 | 0 | 2 |
| Hồi sức | 3 | 3 | 1 | 2 |
| Tổng kết (Siêu khó) | 0 | 2 | 0 | 1 |

Hoàn tác có phí trả lại bàn nhưng không trả lượt: `moves = min(moves của snapshot − 1, moves hiện tại)`. Hết cả hai tầng thì một lần nạp thêm bằng quảng cáo mô phỏng. Rút bài và thu bài là mốc không hoàn tác về trước. Gợi ý có phí tốn 1 lượt, chỉ chỉ thẻ, không vào lịch sử hoàn tác. Nút +10 lượt miễn phí tắt mặc định, chỉ mở trong mục QA. Từ lần thử thứ 3 ở màn có nhãn, thêm 1 hoàn tác miễn phí. Sao: 3 sao khi số thao tác ≤ Cref + 1 và không dùng vật phẩm, quảng cáo, hoàn tác hay gợi ý có phí; 2 sao khi ≤ Cref + 3.

## 3. Chỉ số

| Chỉ số | Định nghĩa | Ở đâu |
|---|---|---|
| Cref | Chi phí (move + draw + recycle) của replay tham chiếu ngắn nhất tìm được, lấy nhỏ nhất giữa solver và bot | `runReplay`, `campaign-replays.ts` |
| B | Ngân sách nhỏ nhất mà replay tham chiếu vẫn thắng | `runReplay().minBudget` |
| Bot thường | Bot tham lam một bước, 12% nhiễu, không hoàn tác | `src/bot.ts` mặc định |
| Bot giỏi | Bot nhìn trước một nước, 5% nhiễu. Giữ để đối chiếu, **không còn dùng để neo màn spike** | `src/bot.ts` với `lookahead: 1` |
| Planner | Bot tìm kiếm chùm sâu 3 nước, hiểu hình học bàn (hàng có ô đá không bao giờ chứa nổi bộ bốn) và thứ tự (cột khóa là món nợ chỉ trả bằng nhóm chìa khóa). Đây là proxy neo cho màn có nhãn | `src/planner.ts` |
| Đường cong | Tỉ lệ thắng của hai bot cho ngân sách từ B − 1 đến B + 9 | `Calibration.curve` |
| Vực (cliff) | Tỉ lệ thắng nhảy hơn 20 điểm trên mục tiêu hoặc rớt hơn 30 điểm dưới mục tiêu giữa hai mức ngân sách liền nhau | `Calibration.cliff` |
| blockScore | (tổng thẻ khác nhóm phải lấy đi trước khi mỗi thẻ lộ + số thẻ trong bộ bài) / số thẻ chưa lên bàn | `layoutMetrics` |
| layoutStats | Số cột lộ, ô trống, ô trống rời rạc, dải trống dài nhất, hàng trống, số nhóm bị tách, tỉ lệ ẩn, bộ bài | `layoutStats` |
| Near-miss | Với mỗi ván thua của bot: thiếu bao nhiêu lượt (chạy lại cùng seed với +k), thua ở đâu trên đường đi, còn mấy nhóm. Với ván thắng: dư mấy lượt | `nearMissProfile`, `Calibration.near` |
| Branching | Số nước đi có ích tại mỗi bước của replay tham chiếu; choke point là bước có ≤ 2 lựa chọn khi còn ≥ 5 thẻ chưa lên bàn | `branchingProfile`, `Calibration.branching` |
| Choke giữa | Choke nằm trong cửa sổ 20% đến 85% đường đi. Đây là chỉ số được gác, xem mục 4.1 | `BranchingProfile.midChokes` |

Nước đi có ích: hợp lệ, không dẫn tới thua hay kẹt, và hoặc gom hoặc nối cụm hoặc rút bài hoặc đặt thẻ lẻ vào hàng còn đủ chỗ cho cả bộ bốn của nó.

## 4. Mục tiêu và cổng theo nhịp

Mục tiêu ngân sách: bot thường thắng 0,90 ở Học, 0,75 Luyện, 0,60 Kết hợp và Thử thách nhẹ, 0,85 Hồi sức; **planner** thắng 0,58 ở Khó và 0,42 ở Siêu khó. Hai mốc planner được neo từ ba lần chơi thật của chủ dự án ngày 17/09: ở ngân sách hôm đó planner thắng 95% ở màn 19 mà anh thấy "qua ngay lần đầu", 77% ở màn 20 "không quá khó", và 72% ở màn 14 "khó thật". Muốn màn có nhãn khó hơn cảm giác đó thì mục tiêu phải nằm dưới các số này.

Cổng bắt buộc cho màn có nhãn (script hiệu chỉnh ghi vào `Calibration.gates`, test chặn khi vi phạm cổng cấu trúc):

- Cấu trúc: tổng số cột có thẻ ≥ 5 (chương 2 là 4) và cột dùng được ngay ≥ 4 (chương 2 là 3), hàng trống = 0, dải trống dài nhất ≤ 3, ô trống ≤ 9 ở chương 3 và ≤ 5 ở chương 4, nhóm bị tách ≥ 4, bộ bài ≤ 4 (Siêu khó ≤ 9). Cột khóa vẫn tính vào tổng số cột vì đó là bề rộng có chủ đích, chỉ không tính vào cột dùng được ngay.
- Ngân sách: planner ở B ≤ mục tiêu + 0,15; bot thường ở ngân sách chốt ≤ 0,35 (Khó) hoặc ≤ 0,50 (Siêu khó).
- Near-miss: ≥ 60% ván thua thiếu ≤ 3 lượt; ≥ 70% ván thua rơi sau 70% đường đi; trung vị lượt dư khi thắng ≤ 2.
- Số nhóm còn lại khi thua **không** dùng làm cổng cho planner. Đo ngày 18/09 cho thấy chỉ số này gây hiểu lầm trong game này: ở màn 14, 62% ván thua chỉ thiếu tối đa 3 lượt nhưng chỉ 33% còn tối đa 2 nhóm. Lý do là planner dựng sẵn nhiều cụm rồi dọn liên tiếp ở cuối, nên thêm hai ba lượt là xong nhiều bộ một lúc. Thước đo đúng cho near-miss ở đây là **thiếu bao nhiêu lượt**, không phải còn mấy nhóm.
- Choke: Khó ≥ 1 choke giữa, Siêu khó ≥ 2 choke giữa (xem 4.1).
- Màn Học và Hồi sức: 0 choke, để nhịp nghỉ thật sự nghỉ. Kết hợp: ≤ 2 choke.

Quy tắc chọn ngân sách: mức nhỏ nhất ≥ B đạt mục tiêu. Nếu đường cong là vực thì lấy mức đầu tiên nằm trong dải [mục tiêu − 0,05; mục tiêu + 0,20]; nếu đường cong nhảy qua cả dải (màn 20 đi từ 26% lên 84% chỉ trong một lượt) thì lấy mức gần mục tiêu nhất, kể cả khi nó nằm dưới mục tiêu, để không phát cho màn spike một ngân sách vượt mục tiêu 40 điểm. Nếu trung vị lượt dư khi thắng bằng 0 và mức trên vẫn trong dải thì lên một lượt để ván thắng có một lượt dư.

### 4.1 Vì sao là choke giữa chứ không phải choke cuối

Bản đầu của cổng yêu cầu ít nhất một choke ở 1/3 cuối đường đi, theo trực giác rằng thất bại nên đến ở đoạn cuối. Đo trên 12 biến thể của ba màn spike cho thấy điều ngược lại: số nước đi có ích **tăng dần về cuối** ở mọi màn, không có ngoại lệ. Lý do nằm trong luật: mỗi bộ bốn hoàn thành sẽ biến mất khỏi bàn và trả lại cả một khoảng trống, nên càng về cuối bàn càng thoáng. Ví dụ màn 20 với cột khóa: dãy branching là 12, 11, 7, 5, 4, 3, 0, 0, 1, 24, 1, 32, 25, ... rồi 49, 48, 31 ở đoạn cuối.

Kết luận: trong Gom Gom, nút thắt không gian nằm ở **giữa ván**, lúc bàn đầy nhất và chưa dọn được bộ nào; còn cảm giác thua sát nút ở cuối đến từ **ngân sách lượt**, không phải từ hết nước đi. Vì vậy cổng choke đổi sang cửa sổ 20% đến 85% đường đi, và phần "thua sát nút" được gác riêng bằng bộ chỉ số near-miss. Choke nằm trước mốc 20% chỉ được ghi nhận là mở màn phải đào chỗ, không bị phạt: đó là kiểu mở màn hợp lệ khi bàn bắt đầu gần kín.

## 5. Quy trình bảo trì

Đổi layout hoặc obstacle của một màn:

```sh
cd /Volumes/Work/APS/Minigame/gomgom
# 1. dò nhanh một biến thể trước khi sửa campaign.ts
PROBE_SOLVE_MS=60000 node --experimental-strip-types scripts/probe-level.ts 14 variant.json 100
# 2. sau khi sửa src/campaign.ts: replay tham chiếu mới
SOLVE_MS=120000 node --experimental-strip-types scripts/solve-campaign.ts 114
# 3. hiệu chỉnh ngân sách, near-miss, choke; ghi campaign-budgets.ts và campaign-replays.ts
CAL_PLAYOUTS=150 node --experimental-strip-types scripts/calibrate-campaign.ts 114
# 4. kiểm tra và sinh báo cáo
npm test && node --experimental-strip-types scripts/report-curve.ts
```

Chạy song song nhiều màn: dùng `SOLVE_OUT` và `CAL_OUT` ghi file riêng rồi gộp bằng `scripts/merge-replays.ts` và `scripts/merge-calibration.ts`. Mỗi lần đổi layout phải tăng `version` của màn để sao và thống kê cũ không bị so lệch.

Đổi mục tiêu hoặc giới hạn hỗ trợ: chỉ sửa `src/tuning.ts` rồi chạy lại hiệu chỉnh cho mọi màn. Đổi luật engine: thêm test trong `test/rules.test.ts` hoặc `test/obstacles.test.ts` trước khi đổi.

## 6. Cách author một màn spike

1. Chọn mechanic cần thử và vị trí choke mong muốn, trong cửa sổ 20% đến 85% đường đi (xem 4.1).
2. Dựng bàn hẹp: 3 đến 9 ô trống rời rạc, không hàng trống, dải trống dài nhất ≤ 3.
3. Dựng nguồn rộng: 5 cột đều có thẻ lộ, mỗi cột 2 đến 4 thẻ, các nhóm bị tách giữa bàn và cột.
4. Đặt 1 đến 2 obstacle: cột khóa chứa thẻ của một bộ cuối, chìa khóa là nhóm hoàn thành giữa đường; hoặc ô đá cuối hàng có cặp đặt sẵn.
5. Chạy probe; đọc cổng và dãy branching; dời obstacle hoặc đổi cột cho tới khi có đủ choke giữa và tỉ lệ thua thiếu ≤ 3 lượt đạt ≥ 60%.
6. Chốt bằng hiệu chỉnh 100 đến 150 lượt chơi, chạy test, sinh báo cáo, ghi quyết định vào mục 8.

- Bot giỏi mới nhìn trước một nước; người giỏi thật nhìn xa hơn. Cần đối chiếu bằng 3 lần chơi không hỗ trợ của chủ dự án ở màn 14, 19, 20 rồi cân lại.
- Đường cong ở màn ngắn là vực: một lượt đổi kết quả 20 đến 70 điểm. Không sửa vực bằng lượt, phải sửa layout.
- Bot thường thắng rất thấp ở Siêu khó là chủ đích cho màn chốt; với người chơi phổ thông cần theo dõi đầu tiên khi có telemetry.
- Chưa có số liệu người chơi thật. Mọi mục tiêu ở đây là neo bằng máy để bắt đầu, theo spec mục 7.5 cần tối thiểu 30 lượt thử đầu không hỗ trợ mỗi màn.
## 7. Giới hạn đã biết

### 7.1 Bot giỏi là proxy sai cho ràng buộc thứ tự

Ba lần chơi của chủ dự án ngày 17/09 cho thứ tự: màn 19 dễ nhất (qua ngay lần đầu), màn 20 ở giữa, màn 14 khó nhất. Bot nhìn trước một nước xếp ngược lại: màn 20 thắng 16%, màn 14 thắng 49%, màn 19 thắng 69%.

Nguyên nhân nằm ở bản chất hai loại vật cản. **Ô đá** là ràng buộc không gian: cả người và máy đều phải xoay xở từng nước, nên bot là proxy hợp lý (màn 14 và 19 khớp thứ tự). **Cột khóa** là ràng buộc thứ tự: người nhìn một cái là biết phải gom Hành tinh trước rồi cột mở, còn bot nhìn trước một nước phải mò ra bằng tìm kiếm nên thất bại rất nhiều. Vì vậy màn 20 khó với máy mà vừa với người.

Hệ quả cho việc hiệu chỉnh: **không được neo ngân sách màn có cột khóa vào bot nhìn trước một nước**. Cần một bot biết lập kế hoạch theo mục tiêu nhóm và nhận ra chìa khóa mở cột. Đang làm; cho tới khi có, các số của màn 20 trong báo cáo phải đọc như giới hạn của máy chứ không phải độ khó thật.

### 7.2 Các giới hạn khác

- Ba màn đầu chương 1 lệch mục tiêu vì với 2 đến 3 nhóm không thể tạo áp lực; báo cáo ghi cờ.
- **Màn 20 giờ là câu đố không gian thuần.** 100% ván thua của planner là do bàn kín và người thắng còn dư 7 lượt, nên ngân sách 33 lượt không ràng buộc gì. Cổng đã bắt đúng. Muốn ngân sách có ý nghĩa trở lại thì phải giảm số thẻ đặt sẵn hoặc giảm số nhóm, chứ không phải cắt lượt.
- **Màn 17 vẫn lệch mục tiêu**: bot thường thắng 23% so với mục tiêu 75%, và thua xa chứ không sát nút (thiếu trung vị 9 lượt). Dấu hiệu layout tự đưa người chơi không tính trước vào đường cụt. Cần dựng lại nhẹ, ví dụ bớt một nhóm nữa hoặc mở thêm ô trống.
- Màn 2 và 4 quá dễ so với mục tiêu vì với 2 đến 3 nhóm không tạo được áp lực.
- Ô đá và cột khóa mới có ở ba màn spike. Bậc thang giới thiệu obstacle (một loại mới mỗi 5 màn, hai màn học trước khi vào spike) chưa làm; hiện màn 14 và 20 dựa vào coach mark để dạy ngay tại chỗ.

## 8. Nhật ký quyết định

| Ngày | Quyết định | Lý do |
|---|---|---|
| 15/09 | Ngân sách = ⌈B × (1 + slack)⌉ | Bản đầu, theo spec |
| 15/09 | Màn 20 thành màn chốt khó | Chủ dự án chơi thấy dễ |
| 16/09 | Hiệu chỉnh theo bot, hỗ trợ có giá, luật áp lực, layout rộng nguồn hẹp bàn cho 14/19/20, nhãn Khó ở 14/19 và Siêu khó ở 20, màn 4 và 9 là Thử thách nhẹ | Bot thắng gần 100% mọi màn; nghiên cứu game đang sống; màn 9 bản 5 cột ghim cặp đo ra dễ hơn |
| 17/09 | Obstacle ô đá và cột khóa, chỉ số near-miss và branching kèm cổng, tài liệu này | Chủ dự án yêu cầu choke point có chủ đích và kiểm soát gần thắng, gần thua |
| 17/09 | Cổng choke đổi từ "1/3 cuối" sang "cửa sổ giữa 20–85%" | Đo 12 biến thể: branching tăng dần về cuối vì dọn xong bộ là trống cả hàng, nên choke cuối là bất khả thi về cấu trúc |
| 17/09 | Cổng bề rộng tách làm hai: tổng số cột và số cột dùng được ngay | Cột khóa là bề rộng có chủ đích, không phải thiếu bề rộng |
| 17/09 | Màn 14 hai ô đá (3,2) và (0,1); màn 19 một ô đá (4,3); màn 20 khóa cột 5 sau nhóm Hành tinh | Ba biến thể này cho choke giữa và near-miss đạt chuẩn; các biến thể khác hoặc thua quá xa hoặc không tạo choke |
| 17/09 | Quy tắc chọn ngân sách khi gặp vực: ưu tiên mức trong dải, nhảy qua dải thì lấy mức gần mục tiêu nhất | Màn 20 từng được cấp 27 lượt cho tỉ lệ 84% trong khi mục tiêu là 40% |
| 17/09 | Thêm cảnh báo "lệch mục tiêu" vào báo cáo | Cổng cũ không bắt được trường hợp ngân sách trượt mục tiêu, dễ chấp nhận im lặng |
| 18/09 | Thêm `src/planner.ts` và chuyển neo màn spike từ bot giỏi sang planner; mục tiêu Khó 0,58 và Siêu khó 0,42 | Bot nhìn trước một nước xếp hạng ngược với chủ dự án ở màn có cột khóa. Bốn policy được thử song song; bản tìm kiếm chùm cho đúng thứ tự và không có điểm mù ở màn đối chứng |
| 18/09 | Hiệu chỉnh lại ba màn spike theo planner: màn 14 giữ 20 lượt, màn 19 từ 28 xuống 27, màn 20 từ 26 xuống 25 | Một lượt ở màn 19 đổi planner từ 95% xuống 65%, đúng mức cần thiết |
| 18/09 | Bỏ "số nhóm còn lại khi thua" khỏi cổng | Chỉ số này ngược chiều với "thiếu mấy lượt" trong game này vì planner dọn nhiều bộ liên tiếp ở cuối |
| 18/09 | **Bỏ hẳn bộ bài và ba khay rút khỏi hành trình; bàn kín là thua** | Quyết định của chủ dự án: khay rút là chỗ giữ thẻ miễn phí, làm game dễ hơn rất nhiều. Xem 2.1b |
| 18/09 | Chương 3 đổi thành "Bàn kín là thua", chương 2 thành "Dời cả cụm"; màn 11 dựng lại; màn 12, 13, 17, 18 dồn bộ bài vào cột | Chủ đề "Thu và rút" không còn tồn tại |
| 18/09 | Màn 17 và 18 giảm còn 6 nhóm | Không còn van xả nên bản 7 nhóm chỉ còn 13% và 25% với bot thường |
| 18/09 | Near-miss tách `stuckShare`; cổng mới "thua vì bàn kín ≤ 70%" | Thua vì bàn kín là thua sớm, không phải sát nút; nếu chiếm gần hết số ván thua thì ngân sách lượt vô nghĩa |
| 17/09 | Chủ dự án chơi thật ba màn spike: 14 "khó thật", 19 "dễ, qua ngay lần đầu", 20 "không quá khó" | Thứ tự cảm nhận của người **ngược** với bot giỏi ở màn 20 (bot 16%, người thấy vừa). Xem 7.1 |
