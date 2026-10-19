# UI Studio — chỉnh UI và thấy ngay trong game

Dành cho UI artist: sửa giao diện 2D (màu, cỡ chữ, vị trí, ảnh) và thấy kết quả ngay trong game, không cần qua Figma hay nhờ dev.
Mọi thay đổi được ghi thẳng vào file thật trong `game/ui/`, rồi commit bằng GitHub Desktop như bình thường (tiền tố `UI:`).

## Mở

```
npm run studio
```

- Trên máy này: mở game như thường `http://localhost:4400` rồi bấm nút **🎨 Studio** ở cột nút dev (góc trái) để bật / tắt studio
  (sửa + lưu được). Studio nhớ đang bật hay tắt. Link `?studio` cũ vẫn chạy (mở sẵn studio).
- Điện thoại cùng wifi: mở địa chỉ `http://<IP>:4400/?dev` mà cửa sổ server in ra (`?dev` để hiện cột nút dev), rồi bấm **Studio**.
  Điện thoại chỉ xem; trên máy tính sửa gì thì điện thoại tự cập nhật theo. Windows có thể hỏi cho Node qua tường lửa: chọn mạng Private.
- Chạy `npm start` thường thì vẫn dùng studio được, chỉ là không xem được trên điện thoại.

## Cách 1: sửa file bằng phần mềm quen dùng

Xuất ảnh PNG đè lên ảnh cũ trong `game/ui/<hub>/img/`, hoặc sửa file `.css` bằng VS Code. Lưu file xong là game đang mở tự cập nhật,
vẫn giữ nguyên màn đang xem (không tải lại trang). Riêng file `.js` / `.mjs` thì game tải lại trang.

## Cách 2: bảng chỉnh trong game (chữ tiếng Anh, thao tác giống Photoshop)

Di chuột lên bất kỳ nút, tên thuộc tính hay ô giá trị nào để xem giải thích ngắn. Nút **?** liệt kê nghĩa các từ + mọi phím tắt.

Bảng là panel nổi như panel Properties của Photoshop: kéo thanh tiêu đề để dời đi đâu cũng được; nút **–** thu bảng thành một icon
tròn nhỏ (như nút AssistiveTouch của iPhone): kéo icon đi đâu cũng được, thả ra tự dính vào cạnh gần nhất, bấm vào để mở lại bảng ngay
cạnh nó. Icon hiện số chấm cam = số sửa chưa lưu. Vị trí bảng / icon được nhớ lại.

| Từ trên bảng | Nghĩa |
|---|---|
| Layer | Một phần tử trên màn hình: nút, bảng, chữ, ảnh |
| Style rule (mỗi thẻ) | Một khối CSS: tên file (xám) + selector (vàng). **×N** = số layer đang dùng khối này: sửa là đổi cả N cái |
| Property (tím) | Thuộc tính, tức là chỉnh cái gì: color, opacity, width… |
| Value (ô trắng) | Giá trị của thuộc tính: `#ff7a2f`, `0.5`, `calc(24 * var(--u))` |
| Màu cam | Đã sửa, chưa lưu |

1. **Select (V)** rồi bấm vào layer (hoặc **Alt** + click bất cứ lúc nào). **Shift** + click chọn thêm / bỏ bớt. **⬆ Parent** hoặc mục
   **Layers** để chọn layer cha / con.
2. Bảng xếp từ trên xuống như panel Design của Figma (bấm tiêu đề mục để thu / mở):
   - **Layers**: cây dọc như panel Layers của Photoshop / Figma (cha ở trên, con thụt vào; trong cùng một cha, layer nằm trên cùng đứng
     đầu). Icon: `#` khung chứa layer khác, `T` chữ, `▨` ảnh, `▭` hình khối. Layer mờ = đang ẩn.
   - **Transform**: **X / Y / W / H** và **R** (bo góc) tính bằng px thiết kế (1 px = 1 px của khung Figma 393 px; X đo từ mép trái
     khung, Y từ mép trên màn hình). Mắt xích khoá tỉ lệ W : H.
   - **Layer** (Opacity %, Blend mode), **Fill** (màu nền), **Stroke** (viền: màu, độ dày, kiểu), **Effects** (Drop / Inner shadow:
     X, Y, Blur, Spread, màu), **Text** (font, cỡ, độ đậm, line height, letter spacing, màu, căn lề, viền chữ, bóng chữ — chỉ hiện ở
     layer có chữ), **Auto layout** (hướng, khoảng cách, padding, căn — chỉ hiện ở layer xếp con theo hàng / cột). Nút **+** / **−**
     thêm / bỏ fill, stroke, shadow.
   - Ô số: **kéo ngang trên nhãn** (X, W, Aa…) để chỉnh như Figma (Shift ×10), hoặc gõ số / ↑ ↓. Ô màu: ô màu + mã hex + độ đục %.
   - **CSS code** (cuối bảng, thu gọn sẵn): khối CSS thô. Các mục trên tự ghi vào đây; chỉ mở khi cần chỉnh thứ bảng chưa có
     (↑ / ↓ trong ô giá trị, **+ property** thêm thuộc tính, ✕ xoá).
3. Kéo trên màn hình: **kéo khung xanh** / **phím mũi tên** để dời; **kéo 8 tay nắm trắng** trên khung để đổi cỡ như Free Transform
   (mép đối diện đứng yên, giữ **Shift** để giữ tỉ lệ). Khi kéo có **đường gióng hồng** (smart guides) hút vào mép / tâm các layer khác
   như Figma / Photoshop, thẻ trên khung hiện X / Y hoặc W / H; giữ **Ctrl** để kéo tự do. Layer chưa có `left` / `top` / `width` /
   `height` thì studio tự thêm vào khối CSS của nó.
4. Thanh công cụ:
   - **Align** (6 nút): một layer thì căn theo khung cha, nhiều layer thì căn với nhau. **Distribute**: chia đều khoảng cách (≥ 3 layer).
   - **Grid** (Ctrl + ') bật / tắt layout grid kiểu Figma; nút **▾** cạnh nó mở cài đặt: **Columns** (đỏ) và **Rows** (xanh) có
     Count / Gutter / Margin, kiểu Stretch (tự chia đều khung 393 px), cộng **Grid** ô vuông (Size). Đơn vị là px thiết kế.
   - **Snap** (Ctrl + Shift + ;): khi kéo, mép / tâm layer hút vào mép cột, mép hàng, lưới ô vuông và mép / tâm khung 393 px.
   - **Link / Unlink** (Ctrl + G / Ctrl + Shift + G): giống **Link Layers** (icon mắt xích) của Photoshop, KHÔNG phải Group (thư mục):
     bấm một layer là chọn cả nhóm, kéo / căn / nhích cùng nhau. Chỉ nhớ trong trình duyệt, **không** đổi cấu trúc HTML
     (gộp layer thật vào một khung chung là sửa code, việc của dev).
   - **Undo / Redo** (Ctrl + Z / Ctrl + Shift + Z hoặc Ctrl + Y), gồm cả thay ảnh. Ctrl + H ẩn / hiện khung xanh và lưới.
5. **Replace…** (hoặc kéo thả file ảnh vào ô ảnh): ghi đè ảnh đó, giữ nguyên tên file.
6. **Save** (Ctrl + S) để ghi vào file. **Revert** bỏ mọi sửa chưa lưu (vẫn Undo được). Chưa lưu mà tải lại trang thì mất.

Căn lề / chia đều báo lỗi khi các layer dùng chung một khối CSS để định vị (dời một cái là dời cả nhóm): căn từng cái, hoặc nhờ dev
tách class.

Lưu ý: kích thước trong game viết theo đơn vị `var(--u)` (1 = 1 px của khung thiết kế 393 px), ví dụ `calc(144 * var(--u))`.
Giữ nguyên dạng đó khi sửa để UI co giãn đúng trên mọi màn hình.

Giới hạn: chỉ UI 2D (HTML / CSS / ảnh trong `game/ui/`). Cảnh 3D, viền toon, mèo 3D vẫn nằm trong code.
