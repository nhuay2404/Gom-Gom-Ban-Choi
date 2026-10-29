// Ví (xu + gem) không bị làm mờ khi mở bảng Quests / Daily: lớp mờ của <dialog> phủ mọi thứ phía sau nên không chừa riêng ví được;
// thay vào đó đặt một BẢN SAO thanh ví đang hiện lên lớp popover (top layer, trên cả lớp mờ), đúng vị trí cũ, số luôn chép theo ví thật.
// Xu / gem bay vào bản sao này (menu/reward-fly.js tìm .wallet-lift trước). Trả về hàm gỡ bản sao (gọi lúc đóng bảng).
// floating: không có ví nào đang hiện (đang ở màn chơi) thì vẫn dựng bản sao của ví Home, đặt đúng chỗ ví Home (góc trên trái khung).
export function liftWallet({ floating = false } = {}) {
  const shown = [...document.querySelectorAll('.wallet-hud')].find(el => el.getClientRects().length);
  if (!shown && floating) return floatWallet(document.querySelector('#map .wallet-hud'));
  const wallet = shown;
  if (!wallet) return () => {};
  const box = wallet.getBoundingClientRect(), copy = wallet.cloneNode(true);
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  copy.classList.add('wallet-lift');
  copy.popover = 'manual';
  copy.setAttribute('aria-hidden', 'true');
  copy.style.cssText = `left:${box.left}px;top:${box.top}px;width:${wallet.offsetWidth}px;height:${wallet.offsetHeight}px`;
  document.body.append(copy);
  copy.showPopover();
  // Trang có thu phóng / lề riêng theo màn hình nên toạ độ đo được không đặt thẳng được: đo ô đầu tiên của bản sao và của ví thật
  // rồi dịch bản sao đúng phần lệch (đổi px hiển thị về px CSS theo tỉ lệ thu phóng của chính bản sao).
  const anchor = wallet.querySelector('.fh-pill'), mirror = copy.querySelector('.fh-pill');
  if (anchor && mirror) {
    const a = anchor.getBoundingClientRect(), m = mirror.getBoundingClientRect(), scale = copy.getBoundingClientRect().width / copy.offsetWidth || 1;
    copy.style.left = `${box.left + (a.left - m.left) / scale}px`;
    copy.style.top = `${box.top + (a.top - m.top) / scale}px`;
  }
  // Chép số từ ví thật mỗi khi nó đổi (refreshWallet viết lại chữ trong các thẻ <b>).
  const source = [...wallet.querySelectorAll('b')], target = [...copy.querySelectorAll('b')];
  const sync = () => source.forEach((el, i) => { if (target[i]) target[i].textContent = el.textContent; });
  const watch = new MutationObserver(sync);
  source.forEach(el => watch.observe(el, { childList: true, characterData: true, subtree: true }));
  return () => { watch.disconnect(); copy.remove(); };
}

function floatWallet(wallet) {
  if (!wallet) return () => {};
  const copy = wallet.cloneNode(true);
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  copy.classList.add('wallet-lift', 'wallet-float');
  copy.popover = 'manual';
  copy.setAttribute('aria-hidden', 'true');
  document.body.append(copy);
  copy.showPopover();
  const source = [...wallet.querySelectorAll('b')], target = [...copy.querySelectorAll('b')];
  const sync = () => source.forEach((el, i) => { if (target[i]) target[i].textContent = el.textContent; });
  const watch = new MutationObserver(sync);
  source.forEach(el => watch.observe(el, { childList: true, characterData: true, subtree: true }));
  return () => { watch.disconnect(); copy.remove(); };
}
