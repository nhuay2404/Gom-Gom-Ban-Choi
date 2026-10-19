// Nguyên tắc biểu cảm mèo 3D — thuần logic (không THREE / DOM) để test được. Bảng này là NGUỒN DUY NHẤT: room-cats.mjs chỉ gọi
// `face(eyes)` với đúng các giá trị dưới đây, mỗi giá trị = đúng một mặt Figma (ui/cat-art.mjs). Quy tắc đầy đủ: CLAUDE.md, mục "Biểu cảm mèo".
//
//   eyes     mặt        nghĩa (nguyên nhân → mặt)
//   open     calm       trung tính: đi, đứng, ngồi, nhìn quanh, vừa làm xong việc
//   focus    cute       quan tâm / muốn: rình, vồ, đuổi, ngó chim bướm, chơi đồ chơi, ngửi tò mò (mắt lấp lánh)
//   happy    happy      vui: được cưng, lăn bụng, bắt được, chạy giỡn, cọ đầu, kêu ♪
//   blink    blink      dễ chịu nhắm mắt: liếm lông, nhồi bột / rừ rừ, uống nước, nằm ấm áp (+ chớp mắt tự nhiên)
//   half     sleepy     buồn ngủ / choáng: bước đệm trước khi ngủ, ngáp, mới thức, quay vòng chóng mặt
//   sleep    sleep      ngủ say (sleep + miệng 'yawn' = ngáp → sleepy)
//   grumble  chew       bực nhẹ: chê (lá đắng), tiếc (hụt mồi), ướt chân, hờn, bị chọc dồn dập / bị bế lâu, liếc ghen
//   annoyed  angry      giận / giật mình mạnh: bị nhấc, xù đuôi, khè, quơ vuốt, bị gai đâm, rơi
export const FACE = { open: 'calm', focus: 'cute', happy: 'happy', blink: 'blink', half: 'sleepy', sleep: 'sleep', grumble: 'chew', annoyed: 'angry' };
export const EYES = Object.keys(FACE);
// Miệng đã nằm trong ảnh mặt: face() không nhận tham số miệng nào khác ngoài 'yawn' (ngáp, đi kèm 'sleep').
export const MOUTHS = ['calm', 'yawn'];

export function expressionOf(eyes, mouth) {
  if (eyes === 'sleep' && mouth === 'yawn') return 'sleepy';
  return FACE[eyes] || 'calm';
}

// Chống nhấp nháy: một mặt đã hiện thì giữ tối thiểu HOLD giây rồi mới đổi sang mặt khác (chớp mắt tự nhiên không tính, nó
// là lớp phủ riêng). Mặt phản ứng trực tiếp với người chơi (cưng, bế, giật mình) đổi ngay — `urgent`.
export const HOLD = .45;
export function settleExpression(state, want, now, urgent = false) {
  if (!state.shown) { state.shown = want; state.since = now; return want; }
  if (want !== state.shown && (urgent || now - state.since >= HOLD)) { state.shown = want; state.since = now; }
  return state.shown;
}
