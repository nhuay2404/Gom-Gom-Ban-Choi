# Gom Gom — bản chơi và tài liệu thiết kế

Thư mục này đủ để chơi game và đọc toàn bộ tài liệu thiết kế. Không cần mã nguồn, không cần cài thư viện.

## Chơi game

| Máy | Cách chơi |
|---|---|
| Windows | Bấm đúp `Choi-Gom-Gom.bat` |
| macOS | Bấm đúp `Choi-Gom-Gom.command` |

Máy cần có **Node.js 18 trở lên**, tải bản LTS ở [nodejs.org](https://nodejs.org). Đó là thứ duy nhất cần cài.

Trình duyệt tự mở sau vài giây. Giữ cửa sổ đen mở trong lúc chơi; đóng cửa sổ là tắt game. Nếu cổng 4400 đang bận, máy chủ tự nhảy sang cổng kế tiếp và trình duyệt vẫn mở đúng.

Muốn chạy bằng tay: `node server.mjs` rồi mở địa chỉ hiện trên màn hình.

**Nếu trên macOS bấm đúp mà không mở được** (hay gặp khi thư mục được nén rồi gửi qua mạng: file mất quyền chạy, hoặc bị macOS đánh dấu chặn) — cách này luôn chạy được:

1. Mở Terminal (bấm `Cmd` + `dấu cách`, gõ `Terminal`, Enter).
2. Gõ chữ `bash` rồi **một dấu cách**.
3. Kéo file `Choi-Gom-Gom.command` từ Finder thả vào cửa sổ Terminal.
4. Bấm Enter.

Muốn sửa hẳn để lần sau bấm đúp được, làm như trên nhưng thay bước 2 bằng `chmod +x` (một dấu cách), rồi làm lại lần nữa với `xattr -d com.apple.quarantine` (một dấu cách).

**Khi gửi thư mục này cho người khác trên macOS,** nén bằng lệnh dưới đây thay vì kéo thả lên Drive — cách này giữ được quyền chạy của file khởi động:

```sh
ditto -c -k --sequesterRsrc --keepParent Gom-Gom-Ban-Choi Gom-Gom-Ban-Choi.zip
```

## Có gì trong đây

| Đường dẫn | Nội dung |
|---|---|
| `game/` | Bản game Gom Gom Rotate, chạy thẳng, không cần build (chi tiết từng file ở bảng dưới) |
| `server.mjs` | Máy chủ tĩnh tối giản, chỉ dùng Node.js, không phụ thuộc thư viện nào |
| `Choi-Gom-Gom.bat` | Trình chạy cho Windows |
| `Choi-Gom-Gom.command` | Trình chạy cho macOS |
| `tools/simulate-levels.mjs` | Bot chơi thử 10 màn để cân độ khó: `node tools/simulate-levels.mjs [số ván] [--sweep]` |
| `tai-lieu/4-Thiet-ke-10-man-Rotate.md` | Thiết kế 10 màn đầu của bản Rotate: nhịp, tutorial, luồng màn hình, số liệu cân bằng |
| `tai-lieu/1-Dac-ta-thiet-ke-va-trien-khai.*` | Đặc tả gameplay, UI, VFX, vật phẩm, progression. Có bản Markdown, Word và PDF |
| `tai-lieu/2-He-thong-do-kho.md` | Cách hệ thống độ khó hoạt động: cơ chế, chỉ số, cổng kiểm tra, quy trình bảo trì, nhật ký quyết định |
| `tai-lieu/3-Bao-cao-curve-20-man.md` | Số liệu 20 màn, sinh tự động từ dữ liệu đã đóng băng |
| `tai-lieu/bieu-do/` | Sáu biểu đồ SVG đi kèm báo cáo |

### Bên trong `game/`

| File | Nội dung |
|---|---|
| `index.html` | Trang game: thanh điểm, bàn chơi, thẻ đang bóc, ô gửi tạm, thẻ sắp tới, hộp hướng dẫn |
| `gom-gom.js` | Vòng chơi chính: kéo thả, xoay thẻ, gửi tạm, thắng/thua, tutorial, bản đồ màn, lưu tiến độ và mọi anim (khói khi đặt, gom mèo, sóng bay về tâm khi thắng, vuốt mèo thả tim, biểu cảm AFK) |
| `levels.mjs` | Dữ liệu 10 màn (bàn, loại mèo, lượt, mục tiêu, thẻ kịch bản, tutorial) và bộ chia thẻ theo màn |
| `scoring.mjs` | Tính điểm theo cỡ cụm |
| `board-rules.mjs` | Luật bàn thuần (không đụng giao diện): đặt thẻ, xoay thẻ, tìm và xoá cụm 3+ mèo cùng loại, phá thùng gỗ sát cụm, chọn điểm hợp nhất |
| `board-rules.test.mjs` | Kiểm thử luật bàn, chạy bằng `node --test game/board-rules.test.mjs` |
| `cat-art.mjs` | 6 loại mèo (cam, xám, trắng, mun, Xiêm, mướp): màu, nét mặt, hình SVG |
| `gom-gom.css` | Giao diện và hiệu ứng: theme vàng kem, thẻ, mũi tên xoay, anim |
| `board-grid.css` | Lưới 6×6 của bàn chơi |
| `favicon.svg` | Icon tab trình duyệt |
| `skins/farm-pop/` | Ảnh skin: `background-pink.png` (nền), `rotate-arrow.png` (mũi tên xoay), `decor-sprites.png` + `decor-sprites-mask.png` (sprite trang trí) |

## Luật chơi tóm tắt (Gom Gom Rotate)

Bàn 6×6. Mỗi lượt kéo thẻ đang bóc (1–3 mèo) thả lên bàn; chạm vào thẻ để xoay trước khi đặt. Gom 3 mèo cùng loại liền kề trở lên thì cụm đó biến mất và được điểm: gom 3 = 30, gom 4 = 50, gom 5 = 80, gom 6+ = 120.

Thùng gỗ chặn ô (không đặt mèo lên được), vỡ khi gom mèo sát bên.

Có 10 màn, mỗi màn một mục tiêu điểm trong số lượt giới hạn; hết lượt hoặc hết chỗ đặt là thua. Màn 1–4 có tutorial. Sao (1–3) tính theo lượt còn dư. Chi tiết ở `tai-lieu/4-Thiet-ke-10-man-Rotate.md`.

Ô gửi tạm dùng không giới hạn số lần: kéo thẻ vào để cất (hoặc đổi với thẻ đang cất), chạm vào ô để lấy thẻ đã cất về.

## Luật chơi bản gốc (theo tài liệu thiết kế)

Các tài liệu trong `tai-lieu/` mô tả bản Gom Gom gốc (mã nguồn ở thư mục `gomgom`), không phải bản Rotate trong `game/`. Tóm tắt bản gốc:

Gom bốn thẻ cùng chủ đề nằm liền nhau trên một hàng ngang. Bàn có 4 cột và 5 hàng. Chỉ lấy được thẻ trên cùng mỗi cột nguồn. Cụm 2 đến 3 thẻ di chuyển nguyên khối. Mỗi lần chuyển thẻ tốn một lượt; thả sai không mất lượt.

Không có bộ bài để gửi thẻ đi, nên **bàn kín mà chưa gom hết nhóm là ván kết thúc**. Luôn chừa chỗ: dọn xong một nhóm là mở lại cả khoảng trống đó.

Có hai ô gửi tạm miễn phí, mỗi ô giữ một thẻ lẻ. Hoàn tác và gợi ý có số lần miễn phí theo từng màn; hết lượt miễn phí thì hoàn tác trả lại bàn nhưng không trả lượt, còn gợi ý tốn một lượt.

Hành trình có 20 màn chia bốn chương. Màn 14 và 19 gắn nhãn Khó, màn 20 gắn nhãn Siêu khó. Sáu màn mẫu ở cuối danh sách chọn màn là bản thử nghiệm cũ, giữ lại để kiểm thử, không thuộc hành trình.

## Lưu ý

Quảng cáo trong game là **mô phỏng cục bộ ba giây**, chưa nối SDK thật, không có giao dịch nào. Tiến độ chơi lưu trong trình duyệt của máy đó; đổi máy hoặc xoá dữ liệu trình duyệt là mất.

Mã nguồn, bộ kiểm thử và các script hiệu chỉnh độ khó nằm ở thư mục `gomgom` bên cạnh, không đóng gói vào đây.
