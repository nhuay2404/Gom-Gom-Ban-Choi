# UI Studio từ xa — ghi chú để bàn tiếp (ghi ngày 2026-10-09, hẹn bàn lại thứ Hai 2026-10-12)

Mục tiêu: UI artist ở xa chỉnh UI bằng UI Studio (`docs/UI-STUDIO.md`) và thay đổi tự vào commit trên GitHub.

Hiện trạng: studio chỉ chạy trong máy / mạng LAN; lệnh ghi file chỉ nhận từ chính máy chạy server; chưa có đăng nhập; chưa tự commit.

Cần thêm, dù chọn cách nào: (1) truy cập từ xa, (2) đăng nhập / mật khẩu, (3) tự commit + push.

## Các cách

**A. Máy mình làm host, artist vào qua đường hầm** (Claude đề xuất)
- Chạy studio trên một bản clone RIÊNG của repo (không phải thư mục đang code) để không đè việc của nhau.
- Mở ra ngoài bằng Cloudflare Tunnel hoặc Tailscale; artist có link HTTPS + mật khẩu.
- Bấm Lưu → server tự `git commit` (tiền tố `UI:`, ghi tên artist) + `git push` lên nhánh riêng (vd. `ui-artist`); merge bằng Pull Request.
- Nhược: máy phải bật + chạy studio. Push dùng tài khoản GitHub trên máy (GitHub Desktop) — cần thử trên terminal của mình
  (push từ môi trường của Claude bị lỗi đăng nhập).

**B. Artist tự chạy trên máy họ**
- Artist cài Node + GitHub Desktop, clone repo, `npm run studio`; thêm nút "Gửi lên GitHub" commit + push nhánh của họ.
- An toàn nhất, không mở máy mình ra internet. Nhược: artist phải cài đặt lần đầu, cần quyền ghi repo.

**C. Không cần server: commit qua GitHub API**
- Game đặt trên GitHub Pages; artist chỉnh + xem trước trên trình duyệt, Lưu → commit thẳng vào nhánh `ui-artist` bằng tài khoản GitHub của họ.
- Không phụ thuộc máy ai. Nhược: mất kiểu "xuất PNG là game tự đổi" (chỉ còn bảng chỉnh + nút thay ảnh); Pages cập nhật chậm vài phút.

## Đề xuất chung
Commit vào nhánh riêng + Pull Request, KHÔNG đẩy thẳng vào nhánh đang làm (`gom-gom-rotate-highscore`): tránh xung đột và để duyệt
trước khi lỗi CSS vào game.

## Câu hỏi còn mở
1. Chọn A, B hay C?
2. Nếu A: Cloudflare Tunnel hay Tailscale?
3. Mỗi lần Lưu là một commit, hay gom lại bằng một nút "Gửi bản sửa"?
