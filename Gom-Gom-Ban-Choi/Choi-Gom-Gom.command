#!/bin/bash
# ============================================================================
#  Gom Gom — chơi trên macOS. Bấm đúp vào file này là xong.
#  Dừng game: bấm Ctrl+C, hoặc đóng cửa sổ Terminal.
#
#  Mở được file này không? Mở Terminal, gõ  bash  và một dấu cách, kéo thả
#  file này vào cửa sổ Terminal rồi bấm Enter. Cách đó luôn chạy được.
#
#  Đừng sửa file này bằng editor trên Windows: kiểu xuống dòng của Windows
#  (CRLF) sẽ làm macOS không chạy được nữa.
# ============================================================================

NODE_TOI_THIEU=18
KHOA="$HOME/Library/Caches/gom-gom-ban-choi.lock"

# Bấm đúp thì thư mục hiện hành là Home, không phải chỗ để file, nên phải tự về.
cd "$(cd -- "$(dirname -- "$0")" && pwd -P)" || exit 1

tam_dung() {
  [ -t 0 ] || return 0            # không phải cửa sổ thật thì đừng chờ vô ích
  echo
  read -r -p "  Bấm Enter để đóng cửa sổ này..." _
}

bao_loi() {
  echo
  echo "  ── Không chạy được ──"
  echo
  while [ $# -gt 0 ]; do echo "  $1"; shift; done
  tam_dung
  exit 1
}

clear 2>/dev/null
echo
echo "  ===================================="
echo "   GOM GOM — đang chuẩn bị cho bạn..."
echo "  ===================================="
echo

# --- 1. Thư mục còn đủ file không? -----------------------------------------
thieu=""
for f in server.mjs game/index.html game/assets; do
  [ -e "$f" ] || thieu="$thieu
  • $f"
done
[ -n "$thieu" ] && bao_loi \
  "Thiếu mấy thứ này trong thư mục:$thieu" \
  "" \
  "Nhiều khả năng file khởi động đã bị tách ra khỏi thư mục gốc." \
  "Hãy giữ nguyên cả thư mục Gom-Gom-Ban-Choi rồi bấm đúp lại."

# --- 2. Game đang chạy sẵn rồi thì mở lại đúng cửa sổ cũ --------------------
# Mỗi cổng là một "nơi lưu" riêng của trình duyệt, nên mở server thứ hai là
# mất tiến độ đang chơi. Thà quay về cái đang chạy.
if [ -f "$KHOA" ]; then
  pid_cu=$(sed -n 1p "$KHOA" 2>/dev/null)
  url_cu=$(sed -n 2p "$KHOA" 2>/dev/null)
  if [ -n "$pid_cu" ] && [ -n "$url_cu" ] && kill -0 "$pid_cu" 2>/dev/null \
     && ps -o command= -p "$pid_cu" 2>/dev/null | grep -q 'Choi-Gom-Gom'; then
    echo "  Gom Gom đang chạy sẵn ở $url_cu"
    echo "  Mở lại cửa sổ đó cho bạn, không bật thêm cái mới."
    open "$url_cu" 2>/dev/null
    tam_dung
    exit 0
  fi
  rm -f "$KHOA"                   # khoá cũ còn sót lại từ lần chạy trước
fi

# --- 3. Tìm Node.js --------------------------------------------------------
# Bấm đúp từ Finder thì shell có thể không nạp ~/.zshrc, mà nvm lại nằm đúng
# ở đó. Vậy nên không tin mỗi PATH, phải tự đi tìm.
ung_vien_node() {
  command -v node 2>/dev/null
  [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ] && \
    ls -1d "${NVM_DIR:-$HOME/.nvm}"/versions/node/v*/bin/node 2>/dev/null | sort -V -r
  for p in /opt/homebrew/bin/node /usr/local/bin/node /opt/local/bin/node \
           "$HOME/.volta/bin/node" "$HOME/.asdf/shims/node" \
           "$HOME/.local/share/fnm/aliases/default/bin/node" \
           "$HOME/Library/Application Support/fnm/aliases/default/bin/node"; do
    [ -x "$p" ] && echo "$p"
  done
}

NODE=""; PHIEN_BAN=""; QUA_CU=""
while IFS= read -r ung; do
  [ -n "$ung" ] && [ -x "$ung" ] || continue
  v=$("$ung" -v 2>/dev/null) || continue
  so=${v#v}; so=${so%%.*}
  case "$so" in ''|*[!0-9]*) continue ;; esac
  if [ "$so" -ge "$NODE_TOI_THIEU" ]; then NODE=$ung; PHIEN_BAN=$v; break; fi
  [ -z "$QUA_CU" ] && QUA_CU=$v
done <<DANH_SACH
$(ung_vien_node)
DANH_SACH

if [ -z "$NODE" ] && [ -n "$QUA_CU" ]; then
  open "https://nodejs.org/en/download" 2>/dev/null
  bao_loi "Node.js trên máy quá cũ: đang có $QUA_CU, game cần v$NODE_TOI_THIEU trở lên." \
          "" \
          "Mình vừa mở trang tải giúp bạn: https://nodejs.org/en/download" \
          "Chọn bản LTS, cài xong thì bấm đúp lại file này."
fi
if [ -z "$NODE" ]; then
  open "https://nodejs.org/en/download" 2>/dev/null
  bao_loi "Máy chưa có Node.js — đây là thứ chạy máy chủ cho game, cài một lần là xong." \
          "" \
          "Mình vừa mở trang tải giúp bạn: https://nodejs.org/en/download" \
          "Chọn bản LTS, cài xong thì bấm đúp lại file này."
fi
echo "  Node.js $PHIEN_BAN - OK"
echo "  Trình duyệt sẽ tự bật sau vài giây."
echo "  Giữ cửa sổ này mở trong lúc chơi. Đóng cửa sổ là tắt game."

# Bắt Ctrl+C ở shell chính để còn chạy tới mấy dòng tạm biệt. node vẫn nhận
# SIGINT trực tiếp từ Terminal nên vẫn tắt bình thường.
trap 'NGUOI_DUNG_TAT=1' INT
trap 'rm -f "$KHOA"' EXIT

# --- 4. Chạy máy chủ -------------------------------------------------------
# server.mjs tự in ra dòng GOMGOM_URL=<địa chỉ> khi mở cổng xong, nên cứ đọc
# đúng dòng đó mà mở trình duyệt — chắc hơn đoán cổng, vì 4400 có thể đang là
# máy chủ của ứng dụng khác. Dòng đó nuốt đi, người chơi không cần thấy.
GOMGOM_QUIET=1 "$NODE" server.mjs 2>&1 | while IFS= read -r dong; do
  case "$dong" in
    GOMGOM_URL=*)
      dia_chi=${dong#GOMGOM_URL=}
      printf '%s\n%s\n' "$$" "$dia_chi" > "$KHOA" 2>/dev/null
      echo
      echo "  Đang chơi tại: $dia_chi"
      open "$dia_chi" 2>/dev/null || {
        echo "  Không tự mở được trình duyệt — bạn mở trình duyệt rồi dán địa chỉ trên vào."
      }
      ;;
    *) printf '%s\n' "$dong" ;;
  esac
done
ma=${PIPESTATUS[0]}

echo
if [ -n "$NGUOI_DUNG_TAT" ] || [ "$ma" -eq 0 ] || [ "$ma" -ge 128 ]; then
  echo "  Đã tắt game. Hẹn gặp lại!"
else
  echo "  Máy chủ dừng bất thường (mã $ma)."
  echo "  Thử bấm đúp lại một lần nữa. Nếu vẫn vậy, chụp màn hình cửa sổ này gửi giúp mình."
  tam_dung
fi
