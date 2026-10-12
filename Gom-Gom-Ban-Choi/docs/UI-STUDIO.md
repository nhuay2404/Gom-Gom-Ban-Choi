# UI Studio — chỉnh UI và thấy ngay trong game

Dành cho UI artist: sửa giao diện 2D (màu, cỡ chữ, vị trí, ảnh) và thấy kết quả ngay trong game, không cần qua Figma hay nhờ dev.
Mọi thay đổi được ghi thẳng vào file thật trong `game/ui/`, rồi commit bằng GitHub Desktop như bình thường (tiền tố `UI:`).

## Mở

```
npm run studio
```

- Trên máy này: mở `http://127.0.0.1:4400/?studio` (sửa + lưu được).
- Điện thoại cùng wifi: mở địa chỉ `http://<IP>:4400/?studio` mà cửa sổ server in ra. Điện thoại chỉ xem; trên máy tính sửa gì thì
  điện thoại tự cập nhật theo. Windows có thể hỏi cho Node qua tường lửa: chọn mạng Private.
- Chạy `npm start` thường thì vẫn mở `?studio` được, chỉ là không xem được trên điện thoại.

## Cách 1: sửa file bằng phần mềm quen dùng

Xuất ảnh PNG đè lên ảnh cũ trong `game/ui/<hub>/img/`, hoặc sửa file `.css` bằng VS Code. Lưu file xong là game đang mở tự cập nhật,
vẫn giữ nguyên màn đang xem (không tải lại trang). Riêng file `.js` / `.mjs` thì game tải lại trang.

## Cách 2: bảng chỉnh trong game

1. Bấm **🎯 Chọn** rồi bấm vào nút / bảng / chữ cần sửa (hoặc giữ **Alt** + click bất cứ lúc nào). **⬆ Cha** chọn phần tử chứa nó.
2. Bảng hiện các khối CSS đang áp vào phần tử, khối thắng ở trên cùng. Sửa giá trị là thấy ngay:
   - ↑ / ↓ trong ô giá trị: tăng giảm con số dưới con trỏ (Shift ×10, Alt ×0.1).
   - Ô màu: bấm ô vuông để chọn màu.
   - Dòng **+ thuộc tính**: thêm thuộc tính mới (gõ vài chữ để có gợi ý).
   - ✕: xoá thuộc tính.
3. **Kéo khung xanh** để dời vị trí (đổi `left` / `top` của khối đó).
4. **Thay ảnh…** (hoặc kéo thả file ảnh vào ô ảnh): ghi đè ảnh đó, giữ nguyên tên file.
5. **Lưu** (hoặc Ctrl + S) để ghi vào file. **↶** bỏ mọi sửa chưa lưu. Chưa lưu mà tải lại trang thì mất.

Lưu ý: kích thước trong game viết theo đơn vị `var(--u)` (1 = 1 px của khung thiết kế 390 px), ví dụ `calc(144 * var(--u))`.
Giữ nguyên dạng đó khi sửa để UI co giãn đúng trên mọi màn hình.

Giới hạn: chỉ UI 2D (HTML / CSS / ảnh trong `game/ui/`). Cảnh 3D, viền toon, mèo 3D vẫn nằm trong code.
