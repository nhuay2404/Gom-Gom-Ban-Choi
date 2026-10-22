# Wiki schema

Wiki kiến thức thiết kế game, theo mô hình "LLM Wiki" của Karpathy
(https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
Claude viết và duy trì `pages/`; người dùng chỉ thêm nguồn vào `raw/` và đặt câu hỏi.

## Ba lớp
- `raw/`: nguồn gốc (PDF, bài viết, ghi chú). **Chỉ đọc, không sửa.** PDF lớn có thể để ngoài repo, ghi đường dẫn trong trang tóm tắt.
- `pages/`: trang markdown do Claude viết: tóm tắt nguồn (`src-*.md`), khái niệm (`concept-*.md`), so sánh, tổng quan. Liên kết nhau bằng `[[ten-trang]]`.
- File này: quy ước và quy trình.

## File dẫn đường
- `index.md`: danh mục mọi trang, mỗi dòng `- [[ten]] — một câu mô tả`, chia theo nhóm. Cập nhật sau mỗi lần ingest. Khi trả lời, đọc file này trước.
- `log.md`: nhật ký chỉ thêm vào cuối, mỗi mục bắt đầu `## [YYYY-MM-DD] ingest|query|lint | tiêu đề` (grep được).

## Quy trình
- **Ingest**: đọc nguồn (PDF đọc theo khoảng ≤20 trang) → viết `pages/src-<nguồn>.md` → tạo/cập nhật các trang khái niệm liên quan (thường 5–15 trang) → cập nhật `index.md` → thêm mục vào `log.md`. Ghi rõ trang/chương nguồn cho mỗi ý.
- **Query**: đọc `index.md`, đọc các trang liên quan, trả lời có trích `[[trang]]`. Câu trả lời đáng giữ thì lưu thành trang mới.
- **Lint**: tìm mâu thuẫn, ý đã cũ, trang mồ côi, khái niệm được nhắc mà chưa có trang, liên kết gãy. Báo lại, sửa khi được đồng ý.
