# Gom Gom tài liệu thiết kế và triển khai

Đặc tả gameplay UI VFX item hỗ trợ difficulty curve và progression

Phiên bản 1.0 · Ngày 15 tháng 9 năm 2026

Đối tượng sử dụng: Game Designer, Developer, Artist, QA và Product Owner. Biên soạn bởi Codex từ yêu cầu của chủ dự án và mã nguồn prototype hiện tại.

Tài liệu này là cơ sở phát triển Gom Gom từ prototype thành bản chơi có progression. Giữ core gom 4 thẻ cùng nhóm trên bàn 4 cột × 5 hàng, art 2D Farm Pop và 2 ô gửi tạm miễn phí cộng 2 ô mở bằng quảng cáo. Công việc tiếp theo tập trung vào 20 màn có lời giải kiểm chứng, item hỗ trợ, lưu tiến độ và tích hợp dịch vụ khi đủ điều kiện phát hành.

Yêu cầu trực tiếp của chủ dự án được ghi là **Đã chốt**. Chức năng đối chiếu với mã nguồn được ghi là **Đã có**. Các thông số kinh tế, mục tiêu playtest, số lượng màn và thiết kế meta trong tài liệu được ghi là **Đề xuất v1**; chúng chưa phải dữ liệu thị trường hay kết quả playtest. Việc tạo tài liệu không thay đổi game đang chạy.

## 1 Phạm vi và thứ tự ưu tiên

### 1.1 Ma trận yêu cầu

| ID | Yêu cầu | Tình trạng | Đầu ra nghiệm thu |
|---|---|---|---|
| R01 | Prototype HTML5 có thể chơi và hoàn thành màn | Đã có | Không mất thẻ hoặc kẹt input; thắng đúng điều kiện |
| R02 | Casual modern 2D theo skin Farm Pop đã chọn | Đã chốt và đã có | Giữ tỉ lệ nhân vật, sprite trong suốt, nét mềm |
| R03 | Thẻ tách rõ khỏi nền cỏ | Đã chốt và đã có | Cụm màu phủ kín; thẻ lẻ nền kem; chọn rõ |
| R04 | VFX cute phù hợp skin | Đã chốt và đã có | Nhún, tim, hoa, rút bài, thưởng và thắng |
| R05 | Hai ô tạm miễn phí và hai ô mở bằng Ads | Đã chốt và đã có bản mô phỏng | Mỗi ô mở độc lập; dùng đến hết ván |
| R06 | Drag and drop vào ra các ô tạm | Đã chốt và đã có | Kéo đúng index; hỗ trợ cả chọn rồi chạm |
| R07 | Item loại nhận khi vượt màn và loại premium | Yêu cầu tài liệu; chưa có inventory | Danh mục, quy tắc dùng, nhận, hoàn tác rõ ràng |
| R08 | Difficulty curve và progression | Yêu cầu tài liệu; hiện có 6 màn mẫu | Bản thiết kế 20 màn, công cụ kiểm chứng và playtest |
| R09 | Ads thật và mua item | Chưa tích hợp | SDK adapter, giao dịch và callback kiểm chứng |

### 1.2 Phạm vi bản v1 đề xuất

Bản playtest tiếp theo gồm 20 màn thủ công, progression tuyến tính, tutorial theo tình huống, ba item đầu tiên là Găng tay, Bánh quy và Đồng hồ. Giữ Hoàn tác và Gợi ý cơ bản miễn phí. Bổ sung ledger nhận và tiêu item để tránh nhân đôi phần thưởng.

Hai ô Ads đã có sẽ thay vai trò mở rộng chỗ chứa của item Giỏ picnic trước đây. Trong v1, Giỏ picnic không còn là item riêng để bán hoặc mở thêm ô thứ năm, thứ sáu. Điều này giữ đúng yêu cầu mới nhất: tổng cộng 4 ô, hai ô cuối mở bằng xem Ads.

Các item Kính lúp, Vé rút bài, Nam châm, Xe gom vườn thuộc đợt tiếp theo. Meta khu vườn được thiết kế ở mức đủ để triển khai sau khi curve cơ bản ổn. Chưa đưa sinh màn ngẫu nhiên, leaderboard, PvP, sự kiện định kỳ hoặc backend tài khoản vào phạm vi bắt buộc.

### 1.3 Thứ tự nguồn quyết định

Khi có khác biệt, dùng yêu cầu mới nhất của chủ dự án trước, tiếp theo là yêu cầu đã chốt trước đó, sau đó là hành vi prototype và cuối cùng là thông số đề xuất trong tài liệu. Không coi đề xuất cũ của trợ lý là quyết định đã được chủ dự án duyệt.

## 2 Trải nghiệm và vòng chơi

### 2.1 Ý tưởng cốt lõi

Người chơi tìm các item cùng chủ đề, đưa lên bàn và nối ngang thành bộ bốn. Cảm giác chính là nhận ra liên hệ, mở được thẻ cần và dọn gọn một nhóm. Thử thách đến từ không gian liền nhau và thứ tự tiếp cận thẻ, không có áp lực thời gian mặc định.

Vòng chơi trong màn: quan sát thẻ trên cùng → chọn hoặc kéo thẻ → đặt vào bàn hay ô tạm → ghép và dọn nhóm → mở thẻ phía dưới → xử lý bộ bài khi cần → hoàn thành tất cả nhóm.

Vòng chơi giữa các màn đề xuất: nhận kết quả và sao → nhận thưởng lần thắng đầu → mở màn kế tiếp → gặp tình huống mới → hoàn thành một chương → mở nội dung hoặc đồ trang trí.

### 2.2 Định nghĩa thành phần

| Thành phần | Quy tắc |
|---|---|
| Thẻ | Một item có ID duy nhất; thuộc đúng một category |
| Nhóm chủ đề | Gồm 4 item khác nhau có liên hệ về nghĩa, ví dụ Táo, Chuối, Nho, Dâu tây |
| Cụm trên bàn | 1 đến 3 thẻ cùng category nằm sát nhau trên một hàng |
| Cột nguồn | Chỉ lấy được thẻ trên cùng; lấy ra mới lộ thẻ tiếp theo |
| Bộ bài | Stack chứa thẻ chưa rút và thẻ lẻ được thu về |
| Khay rút | 3 stack độc lập; mỗi stack chỉ lấy được thẻ trên cùng |
| Ô gửi tạm | Một thẻ lẻ mỗi ô; không ghép hoặc tự dọn trong ô |
| Lượt | Ngân sách thao tác; không phải đồng hồ đếm thời gian |

Đây là bài toán ghép theo chủ đề, không phải ghép bốn hình giống hệt nhau. Art và tutorial phải thể hiện được mối liên hệ; màu chỉ hỗ trợ đọc nhóm.

## 3 Luật gameplay và thứ tự xử lý

### 3.1 Bàn và điều khiển

Bàn luôn có 4 cột × 5 hàng. Thẻ hoặc cụm chỉ chiếm một hàng. Chỉ nối ngang; không ghép dọc hoặc chéo. Cụm 2–3 thẻ di chuyển nguyên cụm, không tách bằng thao tác thường. Khi dời cụm, cho phép đè lên footprint cũ của chính nó nếu vị trí mới không đụng cụm khác hoặc vượt biên.

Có hai cách điều khiển tương đương: chọn thẻ rồi chạm đích; hoặc kéo và thả. Với cụm, vị trí bắt đầu kéo xác định điểm neo để con trỏ không làm cụm nhảy lệch. Drag threshold hiện tại là 6 px. Thả ra ngoài, vào ô khóa, vào ô đã chiếm hoặc vùng không đủ rộng đều trả về vị trí cũ và không tính lượt. Pointer cancel và mất focus phải xóa ghost, không làm mất thẻ.

### 3.2 Chi phí thao tác

| Thao tác thường | Chi phí | Ghi chú |
|---|---|---|
| Đưa một thẻ vào bàn | 1 lượt | Từ nguồn, khay rút hoặc ô tạm |
| Di chuyển cụm trên bàn | 1 lượt | Không tăng theo số thẻ trong cụm |
| Đưa thẻ vào hoặc chuyển giữa ô tạm | 1 lượt | Chỉ nhận thẻ lẻ |
| Rút tối đa 3 thẻ | 1 lượt | Còn 1–2 thẻ vẫn tính 1 lượt |
| Thu tự động khi kín bàn | 1 lượt bổ sung | Chỉ thu thẻ lẻ; giữ cụm 2–3 |
| Chọn, bỏ chọn, xem gợi ý, thả sai | 0 lượt | Không tạo lịch sử nước đi |
| Hoàn tác | 0 lượt | Khôi phục state và lượt của nước đi |
| Mở ô bằng Ads | 0 lượt | Không tự đặt thẻ vào ô vừa mở |
| Hoàn thành nhóm ưu tiên | Thưởng 2 lượt | Một lần mỗi ván khi có mission |

Chuyển thẻ tốn 1 lượt vẫn áp dụng cho cả ô miễn phí và ô Ads. “Miễn phí” của ô tạm nghĩa là không cần xem Ads để mở, không có nghĩa mọi thao tác với ô đều miễn phí.

### 3.3 Ghép và hoàn thành nhóm

Sau một nước đi hợp lệ, sắp các cụm theo hàng và cột, nối các cụm cùng category liền nhau. Một thẻ đặt ở giữa có thể nối cả hai phía. Đủ 4 thẻ thì dọn cả bộ, ghi completed đúng một lần, tăng tiến độ và phát VFX. Nhóm ưu tiên được cộng 2 lượt ngay trong lần xử lý này.

### 3.4 Thu và rút bài

Khi kín 20 ô sau khi xử lý ghép, thu mọi singleton về bộ bài theo thứ tự hàng trên xuống dưới, trái sang phải. Thẻ thu sau nằm gần đỉnh stack hơn. Cụm 2–3 thẻ được giữ lại. Không tự xáo hoặc tạo thêm thẻ.

Mỗi lần rút, pop lần lượt từ đỉnh bộ bài vào khay 1, 2, 3. Thẻ mới che thẻ cũ ở từng khay. Khi lấy thẻ trên ra, thẻ phía dưới phải hiện lại. Đây là thông tin quan trọng để giải bài, không được thay ba stack bằng ba ô chỉ có một thẻ.

### 3.5 Pipeline chuẩn

1. Chặn khi ván đã kết thúc, quảng cáo đang chiếm UI hoặc đang commit nước đi.
2. Kiểm tra source, destination, ô khóa, va chạm và kích thước cụm.
3. Chụp snapshot; trừ phí hợp lệ; chuyển thẻ trong state.
4. Resolve các cụm; dọn bộ bốn; cấp thưởng mission một lần.
5. Nếu đã đủ tất cả nhóm, kết thúc thắng ngay, kể cả còn 0 lượt.
6. Nếu chưa thắng và lượt bằng 0, kết thúc hết lượt trước khi thu bàn.
7. Nếu vẫn đang chơi và bàn kín, thu singleton rồi trừ phí thu; nếu không có singleton, báo stuck.
8. Nếu phí thu làm lượt về 0, báo hết lượt. Kiểm tra invariants, lưu state và render.
9. Phát VFX từ event đã commit. Kết thúc hoặc hủy animation đều phải trả input về trạng thái phù hợp.

Ads mở ô không chạy lại pipeline thu bàn nếu chưa có nước đi. Hồi lượt cho một ván hết lượt có bàn kín phải xử lý lần thu đang chờ đúng một lần.

### 3.6 Thắng thua và cứu ván

Thắng khi tất cả category của màn đã hoàn thành. Hết lượt khi chưa thắng và moves bằng 0. Stuck là trạng thái bàn kín toàn cụm mà luật thu không còn singleton. Không suy ra thua chỉ vì gợi ý không tìm thấy nước tốt.

Prototype có nút tiếp tục miễn phí +10 lượt, giữ thẻ, completed và mission. Đây là cơ chế phục hồi phục vụ thử nghiệm, chưa phải thiết kế kinh tế phát hành. Trong build production đề xuất, cứu ván đi qua item Đồng hồ +8; đặt +10 miễn phí sau cờ internalQA. Chỉ đổi cấu hình production khi luồng item và dịch vụ đã nghiệm thu, không tự loại bỏ cứu ván khỏi bản đang playtest.

Khi đóng hộp hết lượt, thanh trạng thái kết thúc và hành động tiếp tục/hoàn tác/chơi lại vẫn phải rõ. Không để người chơi nhìn thấy một bàn có vẻ hoạt động nhưng mọi thao tác bị im lặng.

## 4 Hệ thống bốn ô gửi tạm

### 4.1 Bố cục và trạng thái

Giữ hàng bộ bài và ba khay rút riêng. Bên dưới có nhãn GỬI TẠM và hàng bốn ô. Thứ tự trái sang phải là ô 1, ô 2 miễn phí; ô 3, ô 4 có khóa và nút XEM ADS. Mỗi ô có vùng chạm tối thiểu 44 × 44 px. Bàn và hàng ô tạm phải tiếp cận được trên mobile mà không tràn ngang.

| Trạng thái ô | Hiển thị | Hành động |
|---|---|---|
| Mở và trống | Nền kem, dấu cộng, số ô | Chạm để đặt thẻ đã chọn; nhận drag |
| Mở và có thẻ | Sprite và số ô nhỏ | Chọn/kéo ra; không nhận thêm thẻ |
| Khóa | Nét đứt, biểu tượng khóa, XEM ADS | Chạm mở lời mời Ads; thả thẻ bị từ chối |
| Đích hợp lệ khi kéo | Viền teal và nền sáng | Chỉ sáng đúng ô đang đủ điều kiện |
| Ván kết thúc | Trạng thái vẫn nhìn thấy | Không mở ô mới hoặc di chuyển thẻ |

Ô tạm không chứa cụm, không tự ghép và không hoán đổi với thẻ đã có. Có thể kéo thẻ giữa hai ô mở nếu ô nhận trống. Kéo vào ô khóa không tự khởi chạy quảng cáo.

### 4.2 Luồng quảng cáo mở ô

Chạm ô khóa → giới thiệu phần thưởng và phạm vi dùng → người chơi chọn xem → ad adapter chạy → nhận xác nhận hoàn tất → xác nhận nhận ô → ô chuyển sang trống và mở. Hai ô mở độc lập; có thể mở ô 4 trước ô 3. Một quảng cáo chỉ mở đúng một ô.

Bản hiện tại là mô phỏng cục bộ 3 giây, có ghi nhãn rõ. Đóng, Escape, tải lại trong khi xem hoặc không nhận được reward callback không cấp ô. Không dùng timer 3 giây làm bằng chứng hoàn tất quảng cáo trong bản production.

Quyền mở tồn tại trong ván đang chơi: còn sau save/load, sau tiếp tục hết lượt và sau hoàn tác. Chơi lại hoặc bắt đầu màn mới reset về hai ô miễn phí. Tải lại cùng ván không reset. Mỗi ván cấp tối đa hai quyền mở, một quyền cho mỗi ô.

### 4.3 Contract cho SDK thật

Ad adapter nhận placementId, runId, slotIndex và requestId duy nhất. Kết quả chỉ là rewarded, cancelled, unavailable hoặc failed. Chỉ rewarded hợp lệ mới cho phép claim; cùng requestId xử lý lại không cấp lần hai. Callback của ván cũ, ô đã mở, slot ngoài 2–3 hoặc variant không có parking phải bị bỏ qua.

Khi quảng cáo lỗi hoặc không có fill, đóng trạng thái loading và đưa người chơi trở về game; không trừ lượt hay item. Khi quay lại từ background, kiểm tra SDK state thay vì tự cho là đã xem đủ. Mute audio trong khi ad hiển thị, khôi phục theo preference trước đó.

Không chọn nhà cung cấp Ads hoặc giả định hỗ trợ thanh toán trong tài liệu này. Developer phải kiểm tra tài liệu SDK của portal phát hành trước lúc tích hợp; các API hiện hành chưa được xác minh tại đây.

## 5 Art UI contrast và VFX

### 5.1 Art direction đã chốt

Giữ casual modern 2D, theme Farm Pop, nhân vật nhỏ với đầu hoặc thân tròn lớn, chi ngắn và silhouette đọc được ở kích thước icon. Stroke mềm vừa đủ, tránh tăng viền đen nặng. Sprite có vùng nền trong suốt; không chuyển sang nhân vật 3D.

Nguồn skin đang dùng là bộ asset đã tạo cho prototype trong public/skins/farm-pop. Sprite atlas màu dùng mask luminance riêng để tạo vùng trong suốt khi render; không mô tả file atlas màu là PNG alpha độc lập. Nếu cần chuyển engine hoặc xuất asset đơn, phải kiểm tra lại alpha, mép trắng và alignment của mask.

### 5.2 Token màu và khả năng đọc

| Thành phần | Giá trị hiện tại | Mục đích |
|---|---|---|
| Thẻ lẻ và thẻ nguồn | #FFF7E8 | Tách item khỏi nền cỏ |
| Ô trống | #365B3040 | Nền xanh trầm trong suốt |
| Viền thẻ | #829A5A | Nét mảnh, không nặng màu đen |
| Viền chọn | #076B63 và halo #FFF6D9 | Đọc được trên nhóm sáng |
| Chữ phụ trên nền cỏ | #29421C | Rõ hơn chữ xanh nhạt |
| Nhóm thú cưng | #C9ADF5 | Tím phủ kín, không pha thành xám |
| Nhóm trái cây | #FFC19B | Cam đào |
| Nhóm hành tinh | #82DCEB | Xanh cyan |
| Nhóm thời tiết | #FFE16E | Vàng |
| Nhóm dụng cụ ăn uống | #E6EDAA | Vàng xanh nhạt |

Các nhóm còn lại: phương tiện #93E1C4; trang phục #F4B8CA; nhạc cụ #D9B6ED; biển #93CEF3; vườn #C5DEA1; đồ nghề #E8C79F. Cụm dùng màu phủ kín; không quay lại cách pha 70% màu với nền cỏ. Background ngoài vùng gameplay có thể nhiều chi tiết hơn trung tâm bàn.

Tiêu chí v1: chữ nhỏ thiết yếu hướng tới contrast tối thiểu 4.5:1, trạng thái focus và điều khiển thiết yếu tối thiểu 3:1 trên bề mặt thực tế. Đây là mục tiêu QA, không phải tuyên bố toàn bộ game đã đạt chuẩn accessibility. Phải đo cả lớp alpha sau khi composite; không chỉ đo mã hex rời. Dùng viền, khóa, dấu cộng và footprint để bổ sung màu sắc.

### 5.3 Danh mục VFX

| Sự kiện | Hình ảnh và chuyển động | Thời lượng mục tiêu |
|---|---|---|
| Chọn thẻ | Art nhún nhẹ, 2 sao nhỏ | 280–450 ms |
| Đặt thẻ | Lá nhỏ và vòng sáng mảnh | 360–500 ms |
| Nhập cụm | Nhún lệch nhịp từng art, tim nhỏ | 360–500 ms |
| Đủ bộ | Nhãn chủ đề, hoa và sao tại hàng vừa dọn | Khoảng 620–850 ms |
| Rút bài | Art bay từ bộ bài ra từng khay, stagger | 320 ms và trễ 45 ms mỗi khay |
| Thưởng mission | Bong bóng +2 bay lên HUD | Khoảng 900 ms |
| Mở ô Ads | Hoa nhỏ quanh ô và âm nhận thưởng | Dưới 1 giây |
| Thắng màn | Hoa/sao, cúp nhún, sao xuất hiện lần lượt | 0.5–1.5 giây |
| Thả sai | Lắc nhẹ hoặc trả về nguồn | Khoảng 280 ms |

Animation chỉ là trình bày, không tạo hoặc xóa card trong state. Animate art bên trong button để không đổi hitbox. Overlay phải pointer-events none, không che modal và không chặn drag. Tối đa 56 particle đồng thời trong implementation hiện tại; particle và animation phải được dọn sau khi kết thúc, hoàn tác hoặc đổi màn. Tôn trọng prefers-reduced-motion; không phát strobe hoặc hiệu ứng toàn màn kéo dài.

Mục tiêu kiểm tra hiệu năng đề xuất: thao tác phản hồi ngay trên thiết bị mobile mục tiêu, không có khựng kéo dài do VFX. Chỉ chốt ngân sách FPS và bộ nhớ sau khi chọn danh sách thiết bị thực; chưa có đo hiệu năng trên điện thoại thật.

## 6 Item hỗ trợ và kinh tế đề xuất

### 6.1 Phân loại và phạm vi

Loại 1 nhận từ vượt màn. Loại 2 premium nhận bằng mua hoặc rewarded ads. Đây là thiết kế cần triển khai, chưa có inventory hoặc cửa hàng trong prototype. Không bán lại chức năng Hoàn tác và Gợi ý cơ bản đang miễn phí.

| ID | Item | Nguồn | Hiệu ứng | Đợt |
|---|---|---|---|---|
| glove | Găng tay khéo léo | Vượt màn | Miễn phí chuyển thẻ/cụm kế tiếp | 1 |
| cookie | Bánh quy năng lượng | Vượt màn | Thêm 2 lượt | 1 |
| magnifier | Kính lúp tìm bạn | Vượt màn | Chỉ vị trí các thẻ còn thiếu của một nhóm | 2 |
| draw_ticket | Vé rút bài | Vượt màn | Một lần rút tối đa 3 thẻ không mất lượt | 2 |
| clock | Đồng hồ thêm giờ | Premium | Thêm 8 lượt, có thể cứu ván hết lượt | 1 |
| magnet | Nam châm đoàn tụ | Premium | Hoàn thành một nhóm đã có cụm trên bàn | 2 |
| garden_cart | Xe gom vườn | Premium | Thu singleton về bộ bài miễn phí | 2 |
| picnic | Giỏ picnic | Gộp vào cơ chế ô Ads | Không có consumable riêng trong v1 | Đã thay thế |

### 6.2 Quy tắc từng item

**Găng tay.** Chạm để arm; chưa trừ item ở bước chọn. Hiện biểu tượng găng trên HUD và cho hủy chọn. Chỉ tiêu 1 item khi commit lần move hợp lệ kế tiếp, gồm move vào hoặc giữa ô tạm. Thả sai không tiêu item. Găng không miễn phí draw hoặc phí thu tự động phát sinh sau move.

**Bánh quy.** Chỉ dùng khi đang chơi; cộng 2 lượt ngay, không tính thêm phí thao tác. Ván đã hết lượt dùng Đồng hồ theo luồng cứu ván. Đề xuất tối đa 2 Bánh quy mỗi ván để còn đọc được hiệu quả curve.

**Kính lúp.** Người chơi chọn một category chưa hoàn thành, có ít nhất một thẻ đã lộ. Hiện vị trí các thẻ còn thiếu: cột nguồn, lớp dưới khay, bộ bài hoặc ô tạm; không xáo stack và không kéo thẻ ra. Thông tin hiện 5 giây hoặc đến khi đóng. Chỉ tiêu item sau khi overlay dữ liệu được mở thành công. Không áp dụng cho category đã completed.

**Vé rút bài.** Tiêu khi draw hợp lệ đã commit. Nếu bộ bài trống thì không tiêu. Vẫn rút theo ba stack và đúng thứ tự cũ; không tăng số thẻ rút.

**Đồng hồ.** Cộng 8 lượt; dùng khi playing hoặc lost, tối đa một lần mỗi ván theo cấu hình v1. Không chữa trạng thái stuck toàn cụm. Khi dùng từ lost, giữ toàn bộ ván và giải quyết một lần thu đang chờ nếu cần. Quảng cáo không sẵn sàng thì không tiêu quyền dùng hoặc khóa nút hoàn tác/chơi lại.

**Nam châm.** Chọn cụm 2–3 thẻ thuộc một category trên bàn. Tìm tất cả thẻ còn lại của category đó trong board, tableau, waste, stock và parking; remove đúng các ID rồi ghi completed một lần. Không cần đặt tạm thẻ vào ô trống. Phải dùng chung logic thưởng mission và thắng, không gọi tiếp merge để dọn hai lần. Tối đa một lần mỗi ván. Không có cụm phù hợp thì không tiêu.

**Xe gom vườn.** Thu toàn bộ singleton đang có trên bàn về stock theo thứ tự thu chuẩn, không cần đủ 20 ô và không tính phí thu. Giữ mọi cụm và thẻ trong ô tạm. Khi không có singleton thì không tiêu. Không tự rút sau khi thu. Tối đa một lần mỗi ván.

Mọi giá trị sử dụng, số lượt và giới hạn trên là thông số khởi đầu đề xuất. Cho phép cấu hình bằng data thay vì hardcode trong UI.

### 6.3 Nhận thưởng và cửa hàng

Đề xuất sau mỗi lần thắng đầu của một màn, cấp 1 item thường theo chu kỳ Găng tay rồi Bánh quy. Khi đợt 2 mở, thêm Vé rút bài và Kính lúp vào chu kỳ. Màn 5, 10, 15, 20 thay phần thưởng mặc định bằng quyền chọn đúng 1 item thường; không cộng thêm một reward thứ hai. Không cấp thưởng vật phẩm lặp lại khi replay vô hạn. Lưu firstWinClaimed theo levelId để refresh màn kết quả không nhận lại.

Build playtest có thể cấp inventory thử nghiệm bằng cờ QA; giao diện và dữ liệu phải tách khỏi economy production. Sau khi xác nhận economy, premium có gói dùng lẻ hoặc gói nhiều lượt sử dụng. Tài liệu chưa chốt giá tiền, SKU, loại tiền mềm hoặc tỉ lệ quy đổi; không tự đặt giá US mà chưa kiểm tra nền tảng và dữ liệu thử nghiệm.

Hai ô Ads luôn dùng placement mở ô riêng, không mua bằng Bánh quy, sao hoặc currency trong v1. Khi Đồng hồ được cấp trực tiếp bởi rewarded ads ở màn thua, reward và consume vào đúng ván phải là một giao dịch, tránh vừa cộng inventory vừa cộng lượt hai lần.

### 6.4 Hoàn tác và tính nhất quán inventory

Một nước move dùng Găng tay chỉ commit khi cả card state và inventory debit thành công. Undo khôi phục nước move, trả lượt theo snapshot và hoàn lại đúng 1 Găng bằng giao dịch bù duy nhất. Không để vừa hoàn item vào inventory vừa giữ găng armed.

Bánh quy, Đồng hồ và các item tác động state tạo undo entry riêng. Undo dùng snapshot trước tác động và refund đúng item đó một lần. Refund do Undo cũng hoàn lại quota sử dụng tương ứng của ván. Với Đồng hồ dùng từ lost, undo trở lại lost; hộp kết thúc phải xuất hiện. Với Nam châm, undo khôi phục các card ở đúng zone/index/layer, completed và mission trước đó.

Kính lúp là dịch vụ thông tin đã xem nên không refund bằng Undo; không tạo game-state undo entry. Hoàn tác gameplay không xóa quyền mở ô Ads, reward vượt màn đã nhận hợp lệ hoặc giao dịch mua. Các trường này nằm trong ledger riêng, không bị ghi đè bằng một snapshot game cũ.

## 7 Difficulty curve và thiết kế 20 màn

### 7.1 Baseline hiện tại

| Màn prototype | Nhóm | Lượt | Mechanic được giới thiệu |
|---|---|---|---|
| 1 | 2 | 16 | Gom bộ bốn |
| 2 | 3 | 22 | Nhận diện hình và mở thẻ phía dưới |
| 3 | 5 | 26 | Dời cụm để chừa chỗ |
| 4 | 6 | 28 | Thu khi bàn kín và rút lại |
| 5 | 8 | 36 | Khay rút chồng lớp |
| 6 | 11 | 54 | Kết hợp các mechanic |

Sáu màn đều có lời giải tham chiếu trong source. Chúng được xây như tình huống test mechanic, tất cả đang mở để thử. Chưa có cơ sở kết luận tỷ lệ thắng hay retention. Bước nhảy từ 3 sang 4 có nguy cơ khó đột ngột vì màn 4 bắt đầu gần kín bàn; đây là nhận định thiết kế, cần playtest xác nhận.

### 7.2 Các núm điều chỉnh

Thứ tự tăng khó ưu tiên: nhận diện nhóm → độ chặn trong cột → khoảng trống liền nhau → vị trí cụm → lớp trong khay rút → ngân sách lượt. Mỗi màn chỉ tăng mạnh một hoặc hai yếu tố. Không coi nhiều category hơn là luôn khó hơn; một bàn ít nhóm nhưng bị chặn không gian có thể khó hơn bàn nhiều nhóm dễ tiếp cận.

Ký hiệu dùng trong ma trận: G là số category; O là số ô board có thẻ lúc bắt đầu; B là ngân sách lượt tối thiểu để replay thành công lời giải tham chiếu cố định với mission và hai ô miễn phí. B không phải lời giải tối ưu toàn cục. Slack là phần dư cộng thêm trên B.

Tất cả màn phải có ít nhất một lời giải không dùng item, không xem Ads và chỉ có hai ô tạm miễn phí. Các quyền hỗ trợ giúp sửa sai và thử nhiều cách hơn.

### 7.3 Ma trận 20 màn đề xuất

| Màn | Nhịp | G | O | Tình huống chính | Slack trên B |
|---|---|---|---|---|---|
| 1 | Học | 2 | 0 | Gom một bộ đã lộ đủ | 60% |
| 2 | Luyện | 2 | 0 | Lấy thẻ mở lớp tiếp theo | 50% |
| 3 | Kết hợp | 3 | 0–2 | Hai nhóm xen kẽ nhẹ | 45% |
| 4 | Thử thách | 3 | 4–6 | Chọn thứ tự lấy thẻ | 35% |
| 5 | Hồi sức | 3 | 0–2 | Thẻ lộ thuận lợi và mốc thưởng | 55% |
| 6 | Học | 4 | 4–6 | Dời cụm đôi để tạo chỗ | 45% |
| 7 | Luyện | 4 | 6–8 | Dời cụm ba đúng điểm neo | 40% |
| 8 | Kết hợp | 4 | 8–10 | Dùng ô tạm mở đường | 35% |
| 9 | Thử thách | 5 | 10–12 | Ô trống rải rác, cần khoảng liền | 25% |
| 10 | Hồi sức | 4 | 4–6 | Tái dùng kỹ năng, ít chặn | 45% |
| 11 | Học | 5 | 18–19 | Thu singleton có hướng dẫn | 45% |
| 12 | Luyện | 5 | 8–12 | Rút bộ bài, các khay còn đơn lớp | 40% |
| 13 | Kết hợp | 6 | 10–12 | Mở một lớp dưới ở khay rút | 35% |
| 14 | Thử thách | 6 | 14–16 | Thứ tự thu và rút ảnh hưởng đường giải | 25% |
| 15 | Hồi sức | 5 | 6–8 | Dọn nhóm liên tiếp và thưởng chương | 45% |
| 16 | Học phối hợp | 6 | 10–12 | Quyết định khi nào giữ thẻ ở ô tạm | 35% |
| 17 | Luyện | 7 | 12–14 | Nhiều nhóm có màu và silhouette khác | 30% |
| 18 | Kết hợp | 7 | 14–16 | Dời cụm và mở lớp khay | 25% |
| 19 | Thử thách | 8 | 16–18 | Lập kế hoạch vài nước và một lần thu | 20% |
| 20 | Hồi sức và tổng kết | 6 | 6–10 | Tái dùng kỹ năng, dọn bàn thỏa mãn | 40% |

Ma trận là brief authoring, chưa phải 20 board đã được tạo. Không dùng trực tiếp số O để random card lên bàn. Mỗi màn cần layout, thứ tự stack và replay riêng được kiểm chứng. Các category 9–11 có thể xuất hiện luân phiên như nội dung mới; không cần đưa đủ 11 nhóm vào một màn sớm.

### 7.4 Quy trình author và kiểm chứng

1. Chọn mechanic muốn dạy, tình huống mở đầu và tiêu chí quan sát được.
2. Dựng board, nguồn, stock và mission bằng danh sách ID có thứ tự. Bảo đảm mỗi category có đúng bốn card.
3. Viết replay tham chiếu bằng hành động hợp lệ; không dùng một greedy hint làm bằng chứng solvable.
4. Replay với ngân sách lớn để ghi cost và timing mission. Tìm B bằng cách thử lại ngân sách của chính replay đó, kiểm tra mọi prefix tránh thua trước lúc nhận mission.
5. Đặt initialMoves bằng làm tròn lên của B nhân với một cộng slack. Replay lại từ đầu và kiểm tra invariants sau từng action.
6. Tạo ít nhất một tình huống sai có thể hồi phục bằng hai ô tạm hoặc Undo. Kiểm tra cả việc người chơi không đi theo replay mẫu.
7. Chạy test với default fun; nếu màn được cho phép ở classic, parking hoặc mission thì phải có replay hợp lệ cho từng variant đó.
8. Playtest, ghi vướng mắc, sửa layout trước khi chỉ tăng thêm lượt. Mỗi thay đổi cần levelVersion mới và chạy lại replay.

Lưu ý không thể cam kết mọi chuỗi nước đi đều dẫn đến thắng. Điều kiện bắt buộc là có lời giải baseline, phản hồi sai rõ và đường phục hồi hợp lý.

### 7.5 Đo và điều chỉnh

| Nhịp màn | Tỷ lệ thắng lần đầu không hỗ trợ mục tiêu | Hướng xử lý khi lệch |
|---|---|---|
| Học | 85–95% | Nếu thấp, sửa tutorial hoặc mở đầu |
| Luyện | 75–90% | Giảm chặn hoặc tăng slack nhỏ |
| Thử thách | 55–75% | Xem điểm nghẽn và tỷ lệ bỏ cuộc |
| Hồi sức | 85–95% | Giảm thao tác thừa, tăng chuỗi dọn nhóm |

Các dải này là giả thuyết nội bộ, không phải benchmark ngành. Tách nhóm không hỗ trợ, dùng item, mở ô Ads và dùng +10 QA. Không so trực tiếp dữ liệu trộn các nhóm đó. Pilot đầu tiên nên quan sát trực tiếp 5–10 người; trước khi chốt thông số dùng tối thiểu khoảng 30 lượt thử đầu không hỗ trợ mỗi màn và ghi rõ hạn chế mẫu nhỏ.

## 8 Progression và phần thưởng

### 8.1 Mở màn và chương

Đề xuất v1 mở tuyến tính: thắng màn N mở N+1; màn đã mở được chơi lại. Giữ chế độ QA mở toàn bộ 6 màn regression và 20 màn mới để kiểm thử. UI phải phân biệt levelId nội bộ, thứ tự campaign và levelVersion; không đổi ID của sáu fixture đang dùng chỉ để đánh số campaign.

Chia 20 màn thành bốn chương năm màn: Làm quen, Chừa chỗ, Thu và rút, Phối hợp. Mỗi chương có nhịp học–luyện–kết hợp–thử thách–hồi sức. Hoàn thành chương mở một bộ item hình ảnh hoặc một đồ trang trí đề xuất. Nội dung phải dùng category đã được giới thiệu trước khi có bài khó dựa vào nó.

### 8.2 Sao và thành tích

Hiện sao phụ thuộc lượt còn lại: 3 sao nếu còn ít nhất mức lớn hơn giữa 2 và 25% lượt ban đầu; 2 sao nếu còn trên 0; 1 sao nếu thắng ở 0. Vì mua thêm lượt có thể làm số lượt dư tăng, đề xuất đổi sang số thao tác thực hiện trước khi phát hành economy.

Đề xuất: Cref là tổng move, draw và recycle của replay tham chiếu, chưa trừ thưởng mission. Cplayer tính cùng cách trên lịch sử còn hiệu lực; Undo loại nước đã hoàn tác. Ba sao khi Cplayer không vượt làm tròn lên 1.10 × Cref; hai sao khi không vượt 1.30 × Cref; thắng còn lại một sao. Lượt cộng thêm không trực tiếp tăng sao. Các item mạnh có thể giúp giảm thao tác; đánh dấu assisted cho analytics, chưa có leaderboard cạnh tranh trong v1.

Lưu bestStars bằng max cũ và mới. Sao dùng mở milestone trang trí theo ngưỡng tổng sao, không tiêu như currency trong bản đầu. Cấp đồ ở mỗi ngưỡng đúng một lần; không cộng lại bestStars vào tổng mỗi lần replay.

### 8.3 Meta khu vườn đề xuất cho đợt sau

Một màn hình khu vườn nhỏ phản ánh tiến độ: mở luống hoa, ao nhỏ, ghế hoặc nhà thú cưng theo chương và mốc sao. Đồ trang trí không cộng lượt hay thay luật màn. Bản đầu dùng điểm đặt sẵn để giảm chi phí editor, pathfinding và UI xây dựng.

Meta không chặn việc chơi màn kế tiếp bằng thời gian chờ. Daily reward, nhiệm vụ tuần và event chỉ thiết kế sau khi có dữ liệu vòng chơi chính; không đưa vào backlog bắt buộc của 20 màn đầu.

## 9 Tutorial và các luồng giao diện

### 9.1 Hướng dẫn theo tình huống

Màn 1 hướng dẫn chọn rồi đặt và ghép đủ bộ; bàn vẫn phản hồi khi người chơi chọn kéo. Màn 2 giải thích thẻ trên cùng. Màn 6–7 hướng dẫn kéo nguyên cụm và điểm neo. Màn 8 giới thiệu hai ô tạm miễn phí. Màn 11 giải thích thu singleton trước khi người chơi kích hoạt. Màn 12–13 giải thích ba stack và lớp bị che.

Mỗi bước chỉ nêu một việc, highlight đúng đối tượng, có thể đóng và xem lại trong Cách chơi. Đánh dấu hoàn thành tutorial theo version; không hiện lặp sau mọi reload. Chưa buộc người chơi xem quảng cáo để hoàn thành tutorial.

### 9.2 Nội dung thông báo mẫu

| Tình huống | Nội dung UI đề xuất |
|---|---|
| Cụm không đủ chỗ | Cụm cần các ô trống liền nhau trên cùng một hàng |
| Ô tạm có thẻ | Ô này đã có bạn rồi Hãy lấy thẻ ra trước |
| Ô Ads khóa | Xem quảng cáo để mở ô này đến hết màn |
| Thả sai | Thẻ đã về chỗ cũ Không mất lượt |
| Bộ bài còn nhưng không có thẻ lộ | Còn thẻ trong bộ bài Chạm để rút tiếp |
| Hết lượt | Tiến độ được giữ nguyên Tiếp tục hoặc hoàn tác nhé |
| Ads không sẵn sàng | Chưa có quảng cáo lúc này Bạn có thể thử lại sau |
| Nhận thưởng | Đã mở ô gửi tạm Kéo một thẻ lẻ vào đây nhé |

Copy cuối cùng dùng giọng trung tính và xưng “Bạn” nhất quán trong sản phẩm. Bản hướng US cần bảng localization tiếng Anh riêng, font hỗ trợ và kiểm thử text expansion; chưa suy luận theme phù hợp US chỉ từ hình ảnh.

### 9.3 Kết quả màn

Win screen hiển thị completed, sao, lượt đã dùng và phần thưởng first win nếu có. Tách nút nhận thưởng với cơ chế chống nhận lặp trong dữ liệu; thao tác nút lặp hoặc reload không tạo item mới. Nút đi tiếp chỉ mở màn hợp lệ. Sau màn 20, hiển thị tổng kết chương và chơi lại, không trỏ tới màn chưa tồn tại.

Lose screen giữ thông tin còn bao nhiêu nhóm; có Hoàn tác, Chơi lại, Đồng hồ nếu đủ điều kiện và cứu ván QA khi cờ bật. Đóng dialog không làm mất các lựa chọn phục hồi trên màn chính.

## 10 Dữ liệu kiến trúc và giao dịch

### 10.1 Cấu trúc hiện tại

| File hoặc vùng | Trách nhiệm |
|---|---|
| src/engine.ts | State thuần, validate, move, merge, collect, draw, unlock |
| src/levels.ts | 44 card, 11 category, 6 màn và replay tham chiếu |
| src/main.ts | Render, pointer, modal, lưu ván, audio, mock Ads |
| src/art.ts | Icon SVG và ánh xạ atlas |
| src/style.css và src/dialogs.css | Layout, contrast và modal |
| src/vfx.ts và src/vfx.css | Hiệu ứng trang trí độc lập |
| test/engine.test.ts | Replay, invariants và các cạnh gameplay |
| test/continue.test.ts | Regression hết lượt và tiếp tục |
| test/parking.test.ts | 4 ô, khóa, bảo toàn card và save cũ |

LocalStorage key hiện tại là gom-gom-v1. State version 1 có parking cho ô đầu; parkingExtra cho ba ô còn lại; parkingUnlocked chứa index 2 hoặc 3. History lưu tối đa 30 snapshot qua reload. Wins và sound nằm cùng save. Nhật ký hành động hiện không lưu toàn bộ qua reload và chỉ xuất cục bộ khi người chơi tải.

### 10.2 Mô hình v2 đề xuất

Tách GameState, Profile, InventoryLedger và PendingReward. GameState giữ board, tableau, waste, stock, parking, completed, moves, mission, stats, runId, levelId, levelVersion, variant và activeItem. Profile giữ unlockedCampaignIndex, bestStars, firstWinClaims, tutorialFlags và cosmeticUnlocks. Ledger giữ grant/debit/refund với transactionId và referenceId. PendingReward lưu request đang chờ xác nhận để xử lý reload hoặc callback trễ.

Trong v2, parking có bốn record gồm cardId, unlocked, unlockSource và runId. Giữ cả reward id đã xử lý để loại trùng. Không dùng index mảng board làm ID dài hạn của một transaction; lưu card IDs và snapshot vì merge có thể sắp lại board index.

### 10.3 Migration

Đọc save v1 và validate trước. Sao lưu bản v1 cục bộ dưới key dự phòng rồi tạo v2 trong bộ nhớ. Chuyển parking sang slot 0; parkingExtra sang slot 1–3; slot 0–1 mở mặc định, slot 2–3 theo parkingUnlocked. Giữ thẻ, layer, moves, completed, mission, continueMoves, wins và sound. Tạo runId cho ván chưa có.

Chỉ ghi key mới khi assertState và checksum/version hợp lệ. Nếu migration lỗi, giữ bản gốc và thông báo có thể khôi phục; không âm thầm reset ván của người dùng về màn 1. Inventory chưa có thì khởi tạo rỗng; vật phẩm test chỉ thêm khi cờ QA cho phép. Không mang quyền ô Ads từ ván cũ sang ván mới.

### 10.4 Commit và undo

Dùng command reducer trả state, events và ledger operations. Validate toàn bộ trước khi commit; không trừ item ở UI rồi hy vọng engine thành công. Commit game-state và ledger atomically trong một save envelope trên bản local; production backend có cơ chế transaction tương ứng nếu được sử dụng.

Undo chỉ đảo tác động gameplay và giao dịch consume có thể hoàn theo mục 6.4. Giữ các entitlement Ads và grant bên ngoài snapshot. Đổi màn tăng epoch hoặc runId; mọi callback, timer và VFX từ ván cũ phải hết hiệu lực. UI luôn mở khóa trong finally khi một commit có animation.

### 10.5 Cấu hình đề xuất

Giữ các khóa cấu hình: enableInternalContinue, internalContinueMoves, clockMoves, freeParkingSlots, rewardedParkingSlots, itemLimitsPerRun, itemRewardCycle, campaignOrder, tutorialVersion và adProviderMode. Default playtest dùng mock; production phải chọn adapter có kiểm tra callback. Kiểm tra consistency cấu hình khi load: freeParkingSlots là 2, tổng slots là 4, clock không dùng ở won hoặc stuck.

## 11 Analytics và playtest

### 11.1 Event cần bổ sung

| Event | Trường tối thiểu riêng |
|---|---|
| level_start | levelVersion, attemptIndex, initialMoves, variant |
| move_commit | sourceZone, targetZone, groupSize, cost, boardOccupancy |
| move_reject | reason, sourceZone, targetZone |
| group_complete | categoryId, turnIndex, missionReward |
| recycle và draw | count, stockCount, wasteDepths |
| parking_use | slotIndex, unlockedBy, direction |
| ad_request và ad_result | placementId, requestId, result, runId |
| item_use và item_refund | itemId, transactionId, reason |
| undo | revertedCommandType, remainingMoves |
| level_end | result, durationActive, turns, recycles, assistance |
| first_win_reward | levelId, rewardId, itemId, transactionId |

Mọi event có eventId, sessionId giả danh, runId, timestamp, buildVersion và campaignIndex. Không thu tên, email, nội dung riêng tư hoặc ảnh màn hình trong telemetry mặc định. Nhật ký đang có chỉ cục bộ; analytics gửi ra dịch vụ là hạng mục mới, cần cấu hình đích và cơ chế quyền riêng tư phù hợp nền tảng phát hành.

### 11.2 Báo cáo và quyết định

Dashboard tối thiểu theo levelVersion: lượt thử đầu, thắng không hỗ trợ, thắng có hỗ trợ, bỏ cuộc, thời gian active, số Undo, lý do move reject, số lần thu, số lần dùng ô tạm, ad fill/reward và lỗi cấp thưởng. Session rời app tạm thời không tính toàn bộ thời gian background vào thời gian giải.

Khi một màn tụt thắng mạnh, đối chiếu replay, heatmap rejected destinations và quan sát người chơi. Nếu không hiểu luật, sửa tutorial; nếu không nhìn ra thẻ, sửa art/contrast; nếu biết cách nhưng thiếu khoảng trống, sửa layout; nếu chỉ thiếu ít lượt, cân slack. Không lấy ad view rate cao làm bằng chứng màn có thiết kế tốt.

## 12 Kế hoạch triển khai và tiêu chí phát hành

### 12.1 Backlog theo phụ thuộc

| ID | Công việc | Vai trò chính | Phụ thuộc | Done khi |
|---|---|---|---|---|
| P01 | Đóng baseline 6 màn và 47 test | Dev và QA | Không | Regression suite ổn, save có fixture |
| P02 | Tách ad adapter và lifecycle | Dev | P01 | Mock và provider chung contract |
| P03 | RunId và migration save v2 | Dev | P01 | Save cũ không mất dữ liệu |
| P04 | Inventory ledger và undo item | Dev | P03 | Debit/refund/grant không lặp |
| P05 | Găng tay Bánh quy Đồng hồ | Dev và GD | P04 | Luật và giới hạn theo spec |
| P06 | Author format và replay validator | Dev và GD | P01 | Board invalid không vào campaign |
| P07 | Tạo và QA màn 1–10 | GD và QA | P06 | Có replay từng màn, đúng nhịp |
| P08 | Tạo và QA màn 11–20 | GD và QA | P07 | Thu/rút và hai ô baseline giải được |
| P09 | Tutorial theo tình huống | UX và Dev | P07 | Không chặn sai hoặc hiện lặp |
| P10 | Campaign sao và first win reward | Dev và GD | P04 P08 | Không nhận lại reward khi replay |
| P11 | Icon item và VFX bổ sung | Artist và Dev | P05 | Đọc được ở mobile, không đổi hitbox |
| P12 | Telemetry và bảng playtest | Dev và QA | P05 P10 | Phân biệt assistance và levelVersion |
| P13 | SDK Ads thật | Dev và QA | P02 nền tảng | Rewarded/cancel/fail/reload đều đúng |
| P14 | Store premium | Dev và Product | P04 SKU nền tảng | Purchase callback không cấp trùng |
| P15 | Playtest và cân curve | GD và QA | P08 P12 | Báo cáo mẫu, điều chỉnh có version |
| P16 | Item đợt 2 và meta vườn | Team | P15 | Không làm giảm độ ổn định core |

Chưa gán số ngày cố định vì chưa biết quy mô team, SDK và phạm vi backend. Có thể làm P02–P06 song song giữa các vai trò; chỉ ghép vào build khi regression pass. Artist có thể dựng icon từ brief trong lúc GD author màn, không cần chờ economy cuối.

### 12.2 Các mốc bàn giao

Mốc A là bản core ổn: 4 ô tạm, save cũ, contrast, VFX và regression. Mốc B là bản chơi 20 màn có tutorial, progression và ba item, sử dụng mock Ads. Mốc C là bản playtest có telemetry và báo cáo curve. Mốc D mới là build tích hợp Ads/store thật, chỉ khi đã chọn nền tảng và nghiệm thu reward/purchase.

### 12.3 Ma trận QA bắt buộc

| ID | Tình huống | Kết quả mong đợi |
|---|---|---|
| Q01 | Ghép sát trái hoặc phải và nối cả hai phía | Đúng category, không vượt 4, clear một lần |
| Q02 | Dời cụm đè footprint cũ | Hợp lệ nếu không đụng cụm khác |
| Q03 | Thả sai hoặc hủy drag | State và lượt giữ nguyên, ghost biến mất |
| Q04 | Đầy bàn có singleton | Thu đúng thứ tự, giữ cụm, tính thêm 1 lượt |
| Q05 | Đầy bàn toàn cụm | Stuck rõ; không reset hoặc mất card |
| Q06 | Win ở lượt cuối | Win ưu tiên, không hiện lose |
| Q07 | Mission cứu lượt cuối | Cộng 2 một lần, tiếp tục hợp lệ |
| Q08 | Rút 1 hoặc 2 thẻ cuối | Chỉ dùng khay tương ứng, không nhân card |
| Q09 | Rút chồng và lấy lớp trên | Hiện lại đúng lớp dưới |
| Q10 | Ô 1 và 2 chứa hai thẻ khác nhau | Đọc đúng index và bảo toàn card |
| Q11 | Thả vào ô Ads khóa | Không nhận thẻ, không mất lượt, không auto ad |
| Q12 | Mở ô 4 trước ô 3 | Ô 4 mở độc lập, ô 3 vẫn khóa |
| Q13 | Cancel/fail/no fill Ads | Không thưởng, loading kết thúc |
| Q14 | Callback lặp hoặc callback ván cũ | Không cấp trùng hoặc mở ở ván khác |
| Q15 | Undo và reload sau mở Ads | Giữ quyền mở và thẻ ở đúng ô |
| Q16 | Chơi lại hoặc đổi màn | Hai ô Ads reset, không còn card ván trước |
| Q17 | Găng armed rồi thả sai | Không tiêu găng hoặc lượt |
| Q18 | Move găng gây auto collect | Miễn move, vẫn thu phí recycle |
| Q19 | Undo item lặp và reload | Refund đúng một lần, không nhân inventory |
| Q20 | Nam châm lấy card từ lớp giữa stack | Không mất card khác; mission/clear đúng một lần |
| Q21 | Win và claim thưởng rồi refresh | BestStars và firstWinReward không cộng lại |
| Q22 | Save v1 đang có parking | Migration giữ card, moves và completed |
| Q23 | Reduced motion và đổi màn giữa VFX | Không animation dư hoặc input lock |
| Q24 | Mobile 320×740 và 375×812 | Không tràn ngang, các ô tạm tiếp cận được |
| Q25 | Màn ngang và safe area | Cuộn được, không che nút hoặc mất vùng drop |
| Q26 | Ads đóng trong lúc sound tắt | Không tự bật âm thanh |
| Q27 | Sáu replay cũ và 20 replay mới | Thắng baseline, assert sau mọi nước |
| Q28 | Mất storage hoặc save lỗi | Thông báo phù hợp, có đường khôi phục |

### 12.4 Điều kiện hoàn thành

Không còn lỗi mất/nhân thẻ, âm moves, card trong ô khóa, reward lặp hoặc khóa input không thoát. Mọi màn phát hành có replay baseline hợp lệ với hai ô miễn phí. Critical flows thắng, thua, Undo, save/load, reward Ads và inventory được test bằng unit và UI.

Build TypeScript/Vite thành công. Bộ test hiện có 47 test đã đạt ở lượt triển khai gần nhất; con số này không bao gồm chức năng tương lai. Cần tăng coverage theo item, migration và SDK trước mốc tương ứng. Thử trên điện thoại cảm ứng thật là điều kiện bổ sung trước phát hành; việc kiểm tra viewport desktop chưa thay thế được bước này.

## 13 Các quyết định cần chốt trước production

| Quyết định | Mặc định để tiếp tục thiết kế | Ảnh hưởng |
|---|---|---|
| Portal hoặc kênh phát hành | Bản web local để playtest | Chọn SDK Ads, store và packaging |
| Nhà cung cấp rewarded Ads | Mock có nhãn rõ | Chưa có doanh thu hoặc ad fill thật |
| Giá và SKU premium | Chưa bật giao dịch thật | Product chốt sau playtest economy |
| Hồi lượt miễn phí +10 | Giữ trong QA, tách feature flag | Không trộn dữ liệu cân màn production |
| Danh mục item đợt đầu | Găng tay, Bánh quy, Đồng hồ | Ba item cần ledger và UI |
| Tiến độ 20 màn | Dùng ma trận đề xuất để author | Cần làm layout/replay thực tế |
| Meta khu vườn | Đợt sau curve cơ bản | Không chặn core playtest |
| Thị trường và ngôn ngữ | UI Việt hiện tại, chuẩn bị locale EN | Cần review copy và nhóm nghĩa cho US |

Các mục này không ngăn team triển khai prototype theo mặc định. Chúng là dependency cho build production, không phải yêu cầu người dùng phải xác nhận lại các thay đổi đã chốt.

## 14 Nguồn và giới hạn xác nhận

Nguồn chính là các yêu cầu trong task này: prototype từ video, art 2D, skin Farm Pop mềm, sprite trong suốt, chỉnh contrast, VFX cute, phân loại item, hai ô miễn phí cộng hai ô Ads, kéo thả, difficulty curve và progression. Hình reference chỉ dùng như tham chiếu hình ảnh; nội dung trong hình không được xem là chỉ dẫn triển khai.

Đối chiếu mã nguồn ngày 15/09/2026 tại project gomgom, đặc biệt engine.ts, levels.ts, main.ts, style.css, vfx.ts, test và README.md. Bản review local là http://127.0.0.1:4318/ trên máy phát triển; link này không phải bản phát hành công khai.

Tài liệu không khẳng định hiệu quả monetization, retention hoặc mức độ phù hợp US đã được chứng minh. Chưa có playtest người dùng, SDK Ads thật, giá premium, backend production hoặc 20 layout mới. Các mục có nhãn đề xuất phải được kiểm chứng qua các mốc ở mục 12.
