# Config game trên Firebase (Remote Config)

Mọi số liệu chỉnh được của game (kinh tế + cảm giác chơi) nằm trên **Firebase Remote Config**. Sửa trên Firebase console →
người chơi mở lại game là nhận số mới, **không cần build / phát hành lại**.

## Cách hoạt động

- Mỗi hằng số trong code khai bằng `remote('TÊN', mặc định)` ↔ một **tham số cùng TÊN** trên Firebase.
  - [`game/gameplay/economy.mjs`](../game/gameplay/economy.mjs) — nhóm **Economy**: `START_COINS`, `LEVEL_REWARD`, `REWARD_BEYOND`,
    `TUTORIAL_TOP_UP`, `COMEBACK_GIFT_MOVES`, `COIN_PACKS`, `STARTER_PACK`, `BOOSTER_PRICE`, `BOOSTER_START_STOCK`,
    `BOOSTER_UNLOCK_LEVEL`, `BOOSTER_EXTRA_MOVES`, `DECO`
  - [`game/gameplay/tuning.mjs`](../game/gameplay/tuning.mjs) — nhóm **Gameplay tuning**: `BOARD`, `HOLD`, `CAGE`, `TIMING`, `DRAG`,
    `LOW_MOVES`, `CAT_BODY`, `CAT_MOTION`, `ADAPTIVE`
- Lúc mở game, [`game/app/main.js`](../game/app/main.js) tải config từ Firebase (chờ tối đa 2,5 s) **rồi mới nạp game**.
  - Tải được: dùng số trên Firebase và lưu lại trong máy.
  - Mạng chậm / mất mạng: dùng bản đã lưu lần trước; chưa từng tải được thì dùng số mặc định trong code.
- Tham số kiểu JSON (object) chỉ cần chứa phần muốn đổi: vd. `BOOSTER_PRICE` = `{"hammer": 50}` thì `swap`, `moves` giữ mặc định.
  Giá trị sai kiểu (vd. chữ thay cho số) bị bỏ qua, game dùng mặc định và cảnh báo trong console.
- Mở DevTools console sẽ thấy dòng `[remote-config] Firebase (N tham số)` / `bản lưu lần trước` / `mặc định trong code`.

## Cài đặt lần đầu (làm một lần)

1. **Tạo project**: vào <https://console.firebase.google.com> → *Add project* (Analytics không bắt buộc).
2. **Tạo web app**: trong project → biểu tượng `</>` (*Add app → Web*) → đặt tên → *Register app*.
   Firebase hiện đoạn `const firebaseConfig = { apiKey: ..., projectId: ..., appId: ... }`.
3. **Dán config vào game**: mở [`game/config/firebase-config.js`](../game/config/firebase-config.js), thay `null` bằng object đó.
   (Các khoá này là định danh công khai của web app, để trong source là bình thường.)
4. **Ghi project id** vào [`.firebaserc`](../.firebaserc): thay `DIEN-PROJECT-ID-FIREBASE-VAO-DAY` bằng `projectId`.
5. **Đẩy toàn bộ config lên Firebase** (cần Node; lần đầu sẽ mở trình duyệt để đăng nhập Google):
   ```bash
   npx -y firebase-tools@13 login
   npm run firebase:deploy
   ```
   Lệnh này sinh [`firebase/remoteconfig.template.json`](../firebase/remoteconfig.template.json) từ số mặc định trong code rồi đẩy lên.
   Vào console → **Remote Config** sẽ thấy 2 nhóm *Economy* và *Gameplay tuning*.
6. Mở game (`npm start`), xem console có dòng `[remote-config] Firebase (21 tham số)`.

## Chỉnh số hằng ngày

- **Cách khuyên dùng — sửa trên Firebase console**: Remote Config → bấm tham số → sửa giá trị → *Save* → **Publish changes**.
  Người chơi nhận số mới ở lần mở game kế tiếp (bản thật hỏi Firebase tối đa 1 lần / giờ; bản dev — localhost hoặc `?dev` —
  hỏi mỗi lần mở). Remote Config còn cho đặt *điều kiện* (theo quốc gia, % người chơi, ngôn ngữ ...) để A/B test giá.
- **Xem số trên Firebase đang làm kinh tế ra sao**: `npm run economy` chỉ tính theo số mặc định trong code. Muốn đối chiếu,
  `npm run firebase:pull` tải config đang chạy về `firebase/remoteconfig.from-firebase.json`.

## ⚠️ Lưu ý khi dùng `npm run firebase:deploy`

`firebase:deploy` **ghi đè toàn bộ** Remote Config trên Firebase bằng số mặc định trong code — mọi chỉnh sửa đã làm trên console
sẽ mất. Chỉ dùng khi: cài đặt lần đầu, hoặc vừa **thêm tham số mới** trong code (khi đó `npm run firebase:pull` trước, chép các
số đang chạy về code, rồi mới deploy). Bình thường chỉ sửa trên console.

## Thêm một tham số mới

1. Trong `economy.mjs` / `tuning.mjs`: `export const TEN_MOI = remote('TEN_MOI', giá_trị_mặc_định);` (tên không được trùng).
2. Code dùng `TEN_MOI` như hằng số bình thường.
3. `npm run firebase:template` (xem lại template) → đẩy lên theo lưu ý ở trên, hoặc tạo tay tham số cùng tên trên console.

Chưa đưa lên Firebase: dữ liệu màn chơi (`game/gameplay/levels.mjs`) và vị trí đồ trong cảnh 3D — có thể thêm theo cách trên nếu cần.
