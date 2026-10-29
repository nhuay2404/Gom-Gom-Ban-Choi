# Asset theo scene (game/assets/img)

Tạo tự động ngày 2026-10-29 bằng cách quét code (js / mjs / css / html) tìm chỗ gọi từng file. **Cột "dùng" là suy ra từ code, không phải chạy thử trong game**; đánh dấu "?" nghĩa là không thấy chỗ nào gọi theo tên (có thể là tên ghép lúc chạy mà mình chưa nhận ra).

Kích thước tính bằng KB. Thay file: ghi đè **cùng tên, cùng thư mục**, giữ tỉ lệ ảnh (CSS đặt khung theo tỉ lệ), rồi tải lại trang (Ctrl+F5).

## Tóm tắt

| Thư mục | Scene | File | Tổng KB |
|---|---|---|---|
| `home/` | Home (lobby): pill ví, nút Daily / Quests / 7 Days / Starter / Cats, icon xu + gem + lịch dùng chung | 14 | 1368 |
| `nav/` | Thanh tab dưới (Home / Deco / Shop) | 8 | 249 |
| `map/` | Bản đồ màn (Map) | 2 | 175 |
| `shop/` | Shop | 19 | 2575 |
| `deco/` | Deco (khu nhà 3D) | 16 | 127 |
| `play/` | Màn chơi (HUD, bàn, booster, nền) | 19 | 8787 |
| `board/` | Màn chơi: ô bàn (hộp, lồng, cỏ, siro, thư…) | 62 | 24222 |
| `result/` | Bảng kết quả thắng / thua | 20 | 4831 |
| `quests/` | Popup Quests + Daily | 48 | 18131 |
| `login-gift/` | Popup 7-Day Gift | 34 | 7054 |
| `idle-reward/` | Popup xu nhàn rỗi (Idle reward) | 19 | 5079 |
| `cats/` | Mèo (hình trong UI) | 46 | 918 |
| `dogs/` | Chó (hình trong UI) | 48 | 286 |
| `farm-pop/` | Màn Farm-pop | 4 | 4778 |
| `tutorial/` | Hướng dẫn (tutorial) | 4 | 197 |

Tổng 363 file, 78777 KB.

## Code gọi file KHÔNG tồn tại (sẽ 404)

- `assets/img/home/btn-daily.png  ←  ui/home/home.css`
- `assets/img/home/btn-feedback.png  ←  ui/home/home.css`
- `assets/img/home/btn-starter.png  ←  ui/home/home.css`
- `assets/img/home/icon-quest-matte.png  ←  index.html`
- `assets/img/home/icon-quest-matte.png  ←  menu/quest-view.mjs`
- `assets/img/home/icon-starter-matte.png  ←  app/store.js`
- `assets/img/home/icon-starter-matte.png  ←  confirmation-kit.html`
- `assets/img/play/hud-panel.png  ←  ui/play/skin.css`
- `assets/img/play/moves-badge.png  ←  ui/play/skin.css`

## File mình (Claude) thêm / thay trong đợt làm UI này

- `assets/img/home/coin-glossy.png`
- `assets/img/home/gem-glossy.png`
- `assets/img/home/icon-daily-glossy.png`
- `assets/img/home/icon-quest-glossy.png`
- `assets/img/home/icon-login-glossy.png`
- `assets/img/quests/close-glossy.png`
- `assets/img/login-gift/gift-close.png`
- `assets/img/login-gift/gift-prev.png`
- `assets/img/login-gift/gift-next.png`
- `assets/img/login-gift/gift2-*.png` (sky, frame, frame-mask, banner, day, name, dot-on, dot-off, claim), `assets/img/result/win2-*.png`, `lose2-*.png`
- Viên Day và viên tên quà (`gift2-day.png`, `gift2-name.png`) là bản ĐÃ XOÁ CHỮ do mình xử lý từ ảnh gốc của bạn (game ghi chữ lên); `gift2-frame-mask.png` là bóng ngoài của khung do mình tạo.

## home/ — Home (lobby): pill ví, nút Daily / Quests / 7 Days / Starter / Cats, icon xu + gem + lịch dùng chung

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `btn-settings.png` | 40 | dùng — `ui/home/home.css` |
| `btn-tile.png` | 58 | dùng — `ui/home/home.css` |
| `coin-glossy.png` | 107 | dùng — `deco/deco-room.mjs`, `menu/daily.js`, `menu/quest-view.mjs` |
| `gem-glossy.png` | 77 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css`, `ui/shop/shop.css` |
| `icon-coin.png` | 17 | dùng — `menu/reward-fly.js`, `ui/deco/deco.css`, `ui/shared/confirmation.css` |
| `icon-daily-glossy.png` | 104 | dùng — `index.html`, `menu/daily.js` |
| `icon-feedback.png` | 26 | dùng — `index.html` |
| `icon-login-glossy.png` | 268 | dùng — `index.html`, `ui/home/home.css` |
| `icon-quest-glossy.png` | 238 | dùng — `index.html`, `ui/home/home.css` |
| `icon-starter.png` | 33 | dùng — `index.html` |
| `pill-coins.png` | 84 | dùng — `ui/home/home.css` |
| `pill-gems.png` | 90 | dùng — `ui/deco/deco.css`, `ui/home/home.css`, `ui/shop/shop.css` |
| `play-button.png` | 153 | dùng — `ui/home/home.css` |
| `sky-bg.jpg` | 73 | dùng — `ui/map/map.css` |

## nav/ — Thanh tab dưới (Home / Deco / Shop)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `icon-deco-matte.png` | 50 | dùng — `index.html`, `play/result.js` |
| `icon-deco.png` | 21 | ? |
| `icon-home-matte.png` | 54 | dùng — `index.html` |
| `icon-home.png` | 25 | ? |
| `icon-shop-matte.png` | 40 | dùng — `index.html` |
| `icon-shop.png` | 18 | ? |
| `tab-active.png` | 23 | dùng — `ui/shared/nav.css`, `ui/shop/shop.css` |
| `tabbar-frame.png` | 18 | dùng — `ui/deco/deco.css`, `ui/shared/nav.css` |

## map/ — Bản đồ màn (Map)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `current-level-pin.png` | 70 | dùng — `deco/map-world.mjs` |
| `grass-bg.jpg` | 105 | dùng — `ui/map/map.css` |

## shop/ — Shop

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `bg.jpg` | 60 | dùng — `ui/shared/loading.css`, `ui/shop/shop.css` |
| `coin-stack.png` | 27 | dùng — `app/store.js`, `confirmation-kit.html` |
| `coin.png` | 17 | dùng — `ui/deco/deco.css`, `ui/play/skin.css`, `ui/result/result.css` |
| `icon-rewarded-ad-gems.png` | 1370 | dùng — `index.html` |
| `sakura.svg` | 1 | dùng — `ui/shop/shop.css` |
| `starter.png` | 439 | dùng — `ui/shop/shop.css` |

### shop/gem-packs/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `gems_1200-modern.png` | 45 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_1200.png` | 60 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_16000-modern-full.png` | 60 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_16000-modern.png` | 41 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_16000.png` | 71 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_200-modern.png` | 32 | dùng — `app/store.js`, `confirmation-kit.html` |
| `gems_200.png` | 42 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_2600-modern.png` | 46 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_2600.png` | 60 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_550-modern.png` | 52 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_550.png` | 42 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_7000-modern.png` | 48 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |
| `gems_7000.png` | 62 | dùng (tên ghép lúc chạy) — menu/shop.js ghép tên theo id gói (gems_<id>-modern.png) |

## deco/ — Deco (khu nhà 3D)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `chip-cats.png` | 9 | dùng — `ui/deco/deco.css` |
| `chip-dogs.png` | 11 | dùng — `ui/deco/deco.css` |
| `chip-fences.png` | 15 | dùng — `ui/deco/deco.css` |
| `chip-furniture.png` | 10 | dùng — `ui/deco/deco.css` |
| `chip-ground.png` | 13 | dùng — `ui/deco/deco.css` |
| `gift-catbed-heart.jpg` | 13 | ? |
| `icon-eye.png` | 23 | dùng — `index.html`, `ui/deco/deco.css` |
| `icon-help.png` | 20 | dùng — `index.html`, `ui/deco/deco.css` |
| `tab-backyard.png` | 2 | dùng — `ui/deco/deco.css` |
| `tab-bathroom.png` | 2 | dùng — `ui/deco/deco.css` |
| `tab-bed.png` | 1 | dùng — `ui/deco/deco.css` |
| `tab-kinder.png` | 2 | dùng — `ui/deco/deco.css` |
| `tab-kitchen.png` | 2 | dùng — `ui/deco/deco.css` |
| `tab-paw.png` | 2 | dùng — `ui/deco/deco.css` |
| `tab-sofa.png` | 1 | dùng — `ui/deco/deco.css` |
| `tab-tree.png` | 1 | dùng — `ui/deco/deco.css` |

## play/ — Màn chơi (HUD, bàn, booster, nền)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `booster-bar-frame.png` | 117 | dùng — `ui/play/hud.css`, `ui/shared/grid.css` |
| `booster-frame.png` | 144 | dùng — `ui/play/skin.css` |
| `booster-hammer.png` | 141 | dùng — `confirmation-kit.html`, `index.html`, `ui/play/skin.css` |
| `booster-moves.png` | 124 | dùng — `confirmation-kit.html`, `index.html`, `play/continue.js` |
| `booster-swap.png` | 132 | dùng — `index.html`, `ui/play/skin.css` |
| `deco-panel.png` | 267 | dùng — `ui/deco/deco.css` |
| `dock-panel.png` | 97 | dùng — `ui/play/skin.css` |
| `hud-frame.png` | 175 | dùng — `ui/play/hud.css`, `ui/shared/grid.css` |
| `meadow-bg.jpg` | 108 | dùng — `ui/play/skin.css` |
| `pill-goal.png` | 69 | dùng — `ui/play/hud.css` |
| `pill-move.png` | 72 | dùng — `ui/play/hud.css` |
| `score-bar.png` | 50 | dùng — `ui/play/skin.css` |
| `slot-blank.png` | 59 | dùng — `ui/play/hud.css`, `ui/play/skin.css` |
| `slot.png` | 68 | dùng — `ui/play/skin.css` |

### play/background-variants/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `GENERATION.txt` | 2 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `autumn-garden.png` | 1814 | ảnh nguồn / bản nháp, không nạp vào game |
| `moonlit-garden.png` | 1863 | ảnh nguồn / bản nháp, không nạp vào game |
| `spring-garden.png` | 1729 | ảnh nguồn / bản nháp, không nạp vào game |
| `sunset-meadow.png` | 1756 | ảnh nguồn / bản nháp, không nạp vào game |

## board/ — Màn chơi: ô bàn (hộp, lồng, cỏ, siro, thư…)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `CONNECTED-TEXTURES.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `GRASS-MINT-GENERATION.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `GRASS-TURF-GENERATION.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `SYRUP-AUTOTILE.txt` | 2 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `SYRUP-BOTTLE-GENERATION.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `SYRUP-GLOSSY-GENERATION.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `SYRUP-GOAL-GENERATION.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `cage-back.png` | 49 | dùng — `ui/board-art.mjs` |
| `cage-bars.png` | 42 | dùng — `ui/board-art.mjs` |
| `cage-door.png` | 18 | dùng — `ui/board-art.mjs` |
| `cage-open.png` | 60 | dùng — `ui/board-art.mjs` |
| `cage.png` | 87 | dùng — `ui/board-art.mjs` |
| `crate-open.png` | 68 | dùng — `ui/board-art.mjs` |
| `crate.png` | 46 | dùng — `ui/board-art.mjs` |
| `grass-deeper-depression-proof.jpg` | 91 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-fringe.svg` | 1 | dùng — `ui/play/base.css` |
| `grass-mint-fringe-proof.jpg` | 86 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-mint-surface.png` | 1727 | dùng — `ui/play/base.css`, `ui/play/skin.css` |
| `grass-pet-depression-proof.jpg` | 14 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-recessed-pets-proof.jpg` | 14 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-saturated-proof.jpg` | 87 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-sheet.png` | 389 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |
| `grass-surface.png` | 1713 | dùng — `ui/board-art.mjs` |
| `grass-turf-proof.jpg` | 110 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-turf-surface.png` | 2311 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |
| `letter.png` | 17 | dùng — `ui/board-art.mjs` |
| `mailbox-open.png` | 50 | dùng — `ui/board-art.mjs` |
| `mailbox.png` | 48 | dùng — `ui/board-art.mjs` |
| `syrup-atlas-material.png` | 1289 | ? |
| `syrup-autotile-proof.jpg` | 62 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-autotile.json` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-autotile.png` | 165 | dùng — `ui/play/base.css` |
| `syrup-autotile.svg` | 1867 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |
| `syrup-bottle-close-60fps.png` | 713 | dùng — `ui/syrup-pour.mjs` |
| `syrup-bottle-closed.png` | 25 | dùng — `ui/syrup-pour.mjs` |
| `syrup-bottle-goal-proof.jpg` | 9 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-edge-repair-proof.jpg` | 28 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-glossy-proof.jpg` | 67 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-glossy-surface.png` | 1439 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |
| `syrup-goal-bottle.png` | 907 | dùng — `ui/board-art.mjs` |
| `syrup-goal-proof.jpg` | 9 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-goal.png` | 755 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |
| `syrup-liquid-edge-proof.jpg` | 29 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `syrup-sheet.png` | 298 | ? |
| `syrup-surface.png` | 1295 | ? |
| `syrup-wavier-edge-proof.jpg` | 35 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `texture-join-mobile-proof.jpg` | 47 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `texture-join-proof.jpg` | 60 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `tin-can.png` | 49 | dùng — `ui/board-art.mjs` |
| `vase-cracked.png` | 69 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |
| `vase.png` | 62 | dùng (tên ghép lúc chạy) — ui/board-art.mjs ghép vase / vase-cracked theo màn |

### board/generated-v1/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `GENERATION.txt` | 3 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `letter.png` | 1109 | dùng — `ui/board-art.mjs` |
| `vase.png` | 869 | ảnh nguồn / bản nháp, không nạp vào game |

### board/generated-v2/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `GENERATION.txt` | 2 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `GRASS-GENERATION.txt` | 2 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `SYRUP-GENERATION.txt` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `grass-sheet.png` | 1854 | ảnh nguồn / bản nháp, không nạp vào game |
| `mailbox-closed.png` | 807 | ảnh nguồn / bản nháp, không nạp vào game |
| `mailbox-open.png` | 892 | dùng — `ui/board-art.mjs` |
| `strawberry-syrup-sheet.png` | 1376 | ảnh nguồn / bản nháp, không nạp vào game |
| `vase-cracked.png` | 991 | ảnh nguồn / bản nháp, không nạp vào game |

## result/ — Bảng kết quả thắng / thua

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `btn-home-round.png` | 36 | dùng — `ui/result/result.css` |
| `btn-next.png` | 85 | dùng — `ui/result/result.css` |
| `btn-retry-round.png` | 40 | dùng — `ui/result/result.css` |
| `btn-retry.png` | 126 | dùng — `ui/result/result.css` |
| `fail-cat.png` | 252 | dùng — `ui/result/result.css` |
| `fail-heart.png` | 198 | dùng — `ui/result/result.css` |
| `fail-title.png` | 120 | dùng — `ui/result/result.css` |
| `lose2-btn-home.png` | 45 | dùng — `ui/result/result.css` |
| `lose2-btn-retry.png` | 69 | dùng — `ui/result/result.css` |
| `lose2-panel.png` | 864 | dùng — `ui/result/result.css` |
| `panel.png` | 835 | dùng — `app/ui-studio.js`, `ui/result/result.css` |
| `win-cat.png` | 267 | dùng — `ui/result/result.css` |
| `win-cleared.png` | 18 | dùng — `ui/result/result.css` |
| `win-score.png` | 264 | dùng — `ui/result/result.css` |
| `win-stars.png` | 399 | dùng — `ui/result/result.css` |
| `win-title.png` | 157 | dùng — `ui/result/result.css` |
| `win2-btn-home.png` | 36 | dùng — `ui/result/result.css` |
| `win2-btn-next.png` | 39 | dùng — `ui/result/result.css` |
| `win2-btn-reward.png` | 60 | dùng — `ui/result/result.css` |
| `win2-panel.png` | 921 | dùng — `ui/result/result.css` |

## quests/ — Popup Quests + Daily

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `badge.png` | 3 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `badge.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `banner.png` | 446 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `button-claim.png` | 5 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `button-claim.svg` | 1 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css` |
| `button-disabled.png` | 4 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `button-disabled.svg` | 1 | dùng — `ui/home/quests.css` |
| `button-pressed.png` | 5 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `button-pressed.svg` | 1 | dùng — `ui/home/quests.css` |
| `button-secondary.png` | 4 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `button-secondary.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `card-active.png` | 4 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `card-active.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `card-complete.png` | 5 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `card-complete.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `card-ready.png` | 5 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `card-ready.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `check.png` | 765 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `close-glossy.png` | 94 | dùng — `ui/home/quests.css` |
| `close.png` | 16 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `close.svg` | 1 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css`, `ui/shared/confirmation.css` |
| `empty.png` | 1332 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `icon-area.png` | 1358 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `icon-build.png` | 895 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `icon-coin.png` | 17 | dùng — `menu/reward-fly.js`, `ui/deco/deco.css`, `ui/shared/confirmation.css` |
| `icon-level.png` | 866 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `icon-pets.png` | 1238 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `icon-quest.png` | 68 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `icon-styles.png` | 1183 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `manifest.json` | 5 | dùng — `idle-reward-kit.html`, `login-gift-kit.html`, `quest-kit.html` |
| `panel.png` | 13 | dùng — `app/ui-studio.js`, `ui/result/result.css` |
| `panel.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `progress-fill.png` | 2 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `progress-fill.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `progress-track.png` | 2 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `progress-track.svg` | 1 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |
| `sparkle.png` | 524 | dùng (tên ghép lúc chạy) — menu/quest-view.mjs đọc quests/manifest.json (icon-${...}.png) |

### quests/painted/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `banner-prompt.json` | 0 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `banner.png` | 1090 | ảnh nguồn / bản nháp, không nạp vào game |
| `check.png` | 765 | ảnh nguồn / bản nháp, không nạp vào game |
| `empty.png` | 1332 | ảnh nguồn / bản nháp, không nạp vào game |
| `icon-area.png` | 1358 | ảnh nguồn / bản nháp, không nạp vào game |
| `icon-build.png` | 895 | ảnh nguồn / bản nháp, không nạp vào game |
| `icon-level.png` | 866 | ảnh nguồn / bản nháp, không nạp vào game |
| `icon-pets.png` | 1238 | ảnh nguồn / bản nháp, không nạp vào game |
| `icon-styles.png` | 1183 | ảnh nguồn / bản nháp, không nạp vào game |
| `prompts.json` | 9 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `sparkle.png` | 524 | ảnh nguồn / bản nháp, không nạp vào game |

## login-gift/ — Popup 7-Day Gift

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `badge-exclusive.svg` | 0 | dùng — `ui/home/login-gift.css` |
| `badge-premium.svg` | 1 | dùng — `ui/home/login-gift.css` |
| `button-claim.svg` | 0 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css` |
| `button-later.svg` | 0 | dùng — `ui/home/login-gift.css` |
| `check.png` | 765 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `close.png` | 4 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `close.svg` | 1 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css`, `ui/shared/confirmation.css` |
| `gift-close.png` | 94 | dùng — `ui/home/login-gift.css` |
| `gift-next.png` | 31 | dùng — `ui/home/login-gift.css` |
| `gift-prev.png` | 31 | dùng — `ui/home/login-gift.css` |
| `gift2-banner.png` | 616 | dùng — `ui/home/login-gift.css` |
| `gift2-claim.png` | 211 | dùng — `ui/home/login-gift.css` |
| `gift2-day.png` | 143 | dùng — `ui/home/login-gift.css` |
| `gift2-dot-off.png` | 41 | dùng — `ui/home/login-gift.css` |
| `gift2-dot-on.png` | 46 | dùng — `ui/home/login-gift.css` |
| `gift2-frame-mask.png` | 2 | dùng — `ui/home/login-gift.css` |
| `gift2-frame.png` | 198 | dùng — `ui/home/login-gift.css` |
| `gift2-name.png` | 164 | dùng — `ui/home/login-gift.css` |
| `gift2-sky.png` | 286 | dùng — `ui/home/login-gift.css` |
| `hammer.png` | 141 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `heart-cushion.jpg` | 13 | dùng — `menu/login.js` |
| `hero-cat.png` | 267 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `icon-coin.png` | 23 | dùng — `menu/reward-fly.js`, `ui/deco/deco.css`, `ui/shared/confirmation.css` |
| `icon-login.png` | 312 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `manifest.json` | 2 | dùng — `idle-reward-kit.html`, `login-gift-kit.html`, `quest-kit.html` |
| `moves.png` | 124 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `reward-day1.png` | 545 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `reward-day2.png` | 546 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `reward-day4.png` | 536 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `reward-day5.png` | 610 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `reward-day6.png` | 543 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `reward-day7.png` | 625 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `swap.png` | 132 | dùng (tên ghép lúc chạy) — menu/login.js ghép reward-day${n}.png |
| `title-banner.svg` | 1 | dùng — `ui/home/login-gift.css` |

## idle-reward/ — Popup xu nhàn rỗi (Idle reward)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `banner.png` | 446 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `bonus-badge.png` | 2 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `bonus-badge.svg` | 1 | dùng — `ui/shared/idle-reward.css` |
| `button-claim.png` | 3 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `button-claim.svg` | 1 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css` |
| `button-video.png` | 4 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `button-video.svg` | 1 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `close.png` | 4 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `close.svg` | 1 | dùng — `ui/home/login-gift.css`, `ui/home/quests.css`, `ui/shared/confirmation.css` |
| `coin-stack.png` | 27 | dùng — `app/store.js`, `confirmation-kit.html` |
| `icon-coin.png` | 17 | dùng — `menu/reward-fly.js`, `ui/deco/deco.css`, `ui/shared/confirmation.css` |
| `icon-pet.png` | 1238 | dùng (tên ghép lúc chạy) — menu/idle-reward-view.mjs đọc idle-reward/manifest.json |
| `icon-video.png` | 292 | dùng — `idle-reward-kit.html`, `ui/shared/confirmation-view.mjs` |
| `manifest.json` | 1 | dùng — `idle-reward-kit.html`, `login-gift-kit.html`, `quest-kit.html` |
| `panel.png` | 839 | dùng — `app/ui-studio.js`, `ui/result/result.css` |

### idle-reward/painted/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `banner-prompt.json` | 0 | tài liệu / ảnh kiểm thử, không nạp vào game |
| `banner.png` | 1090 | ảnh nguồn / bản nháp, không nạp vào game |
| `icon-video.png` | 1111 | dùng — `idle-reward-kit.html`, `ui/shared/confirmation-view.mjs` |
| `prompt.json` | 1 | tài liệu / ảnh kiểm thử, không nạp vào game |

## cats/ — Mèo (hình trong UI)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `gray-angry.png` | 19 | dùng — `ui/cat-art.mjs` |
| `gray-body.png` | 14 | dùng — `ui/cat-art.mjs` |
| `gray-calm.png` | 20 | dùng — `ui/cat-art.mjs` |
| `gray-chew.png` | 24 | dùng — `ui/cat-art.mjs` |
| `gray-cute.png` | 36 | dùng — `ui/cat-art.mjs` |
| `gray-happy.png` | 18 | dùng — `ui/cat-art.mjs` |
| `gray-sleepy.png` | 9 | dùng — `ui/cat-art.mjs` |
| `orange-angry.png` | 18 | dùng — `ui/cat-art.mjs` |
| `orange-body.png` | 19 | dùng — `ui/cat-art.mjs` |
| `orange-calm.png` | 20 | dùng — `ui/cat-art.mjs` |
| `orange-chew.png` | 15 | dùng — `ui/cat-art.mjs` |
| `orange-cute.png` | 24 | dùng — `ui/cat-art.mjs` |
| `orange-happy.png` | 9 | dùng — `ui/cat-art.mjs` |
| `orange-sleepy.png` | 8 | dùng — `ui/cat-art.mjs` |
| `siamese-angry.png` | 14 | dùng — `ui/cat-art.mjs` |
| `siamese-body.png` | 18 | dùng — `ui/cat-art.mjs` |
| `siamese-calm.png` | 13 | dùng — `ui/cat-art.mjs` |
| `siamese-chew.png` | 12 | dùng — `ui/cat-art.mjs` |
| `siamese-cute.png` | 27 | dùng — `ui/cat-art.mjs` |
| `siamese-happy.png` | 9 | dùng — `ui/cat-art.mjs` |
| `siamese-sleepy.png` | 10 | dùng — `ui/cat-art.mjs` |
| `tabby-angry.png` | 18 | dùng — `ui/cat-art.mjs` |
| `tabby-body.png` | 63 | dùng — `ui/cat-art.mjs` |
| `tabby-calm.png` | 15 | dùng — `ui/cat-art.mjs` |
| `tabby-chew.png` | 17 | dùng — `ui/cat-art.mjs` |
| `tabby-cute.png` | 33 | dùng — `ui/cat-art.mjs` |
| `tabby-happy.png` | 22 | dùng — `ui/cat-art.mjs` |
| `tabby-sleepy.png` | 9 | dùng — `ui/cat-art.mjs` |
| `tuxedo-angry.png` | 16 | dùng — `ui/cat-art.mjs` |
| `tuxedo-body.png` | 20 | dùng — `ui/cat-art.mjs` |
| `tuxedo-calm.png` | 17 | dùng — `ui/cat-art.mjs` |
| `tuxedo-chew.png` | 19 | dùng — `ui/cat-art.mjs` |
| `tuxedo-cute.png` | 30 | dùng — `ui/cat-art.mjs` |
| `tuxedo-happy.png` | 20 | dùng — `ui/cat-art.mjs` |
| `tuxedo-sleepy.png` | 8 | dùng — `ui/cat-art.mjs` |
| `white-angry.png` | 13 | dùng — `ui/cat-art.mjs` |
| `white-body.png` | 17 | dùng — `ui/cat-art.mjs` |
| `white-calm.png` | 11 | dùng — `ui/cat-art.mjs` |
| `white-chew.png` | 12 | dùng — `ui/cat-art.mjs` |
| `white-cute.png` | 23 | dùng — `ui/cat-art.mjs` |
| `white-happy.png` | 10 | dùng — `ui/cat-art.mjs` |
| `white-sleepy.png` | 16 | dùng — `ui/cat-art.mjs` |

### cats/fat/

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `body.png` | 108 | dùng (tên ghép lúc chạy) — ui/cat-art.mjs ghép face-<biểu cảm>.png |
| `face-annoyed.png` | 11 | dùng (tên ghép lúc chạy) — ui/cat-art.mjs ghép face-<biểu cảm>.png |
| `face-happy.png` | 25 | dùng (tên ghép lúc chạy) — ui/cat-art.mjs ghép face-<biểu cảm>.png |
| `face-sleep.png` | 9 | dùng (tên ghép lúc chạy) — ui/cat-art.mjs ghép face-<biểu cảm>.png |

## dogs/ — Chó (hình trong UI)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `dalmatian-angry.png` | 6 | dùng — `ui/cat-art.mjs` |
| `dalmatian-body.png` | 11 | dùng — `ui/cat-art.mjs` |
| `dalmatian-calm.png` | 6 | dùng — `ui/cat-art.mjs` |
| `dalmatian-chew.png` | 5 | dùng — `ui/cat-art.mjs` |
| `dalmatian-cute.png` | 8 | dùng — `ui/cat-art.mjs` |
| `dalmatian-happy.png` | 4 | dùng — `ui/cat-art.mjs` |
| `dalmatian-sleep.png` | 2 | dùng — `ui/cat-art.mjs` |
| `dalmatian-sleepy.png` | 5 | dùng — `ui/cat-art.mjs` |
| `golden-angry.png` | 6 | dùng — `ui/cat-art.mjs` |
| `golden-body.png` | 6 | dùng — `ui/cat-art.mjs` |
| `golden-calm.png` | 9 | dùng — `ui/cat-art.mjs` |
| `golden-chew.png` | 4 | dùng — `ui/cat-art.mjs` |
| `golden-cute.png` | 8 | dùng — `ui/cat-art.mjs` |
| `golden-happy.png` | 6 | dùng — `ui/cat-art.mjs` |
| `golden-sleep.png` | 2 | dùng — `ui/cat-art.mjs` |
| `golden-sleepy.png` | 5 | dùng — `ui/cat-art.mjs` |
| `malamute-angry.png` | 9 | dùng — `ui/cat-art.mjs` |
| `malamute-body.png` | 12 | dùng — `ui/cat-art.mjs` |
| `malamute-calm.png` | 9 | dùng — `ui/cat-art.mjs` |
| `malamute-chew.png` | 7 | dùng — `ui/cat-art.mjs` |
| `malamute-cute.png` | 10 | dùng — `ui/cat-art.mjs` |
| `malamute-happy.png` | 3 | dùng — `ui/cat-art.mjs` |
| `malamute-sleep.png` | 2 | dùng — `ui/cat-art.mjs` |
| `malamute-sleepy.png` | 7 | dùng — `ui/cat-art.mjs` |
| `pug-angry.png` | 7 | dùng — `ui/cat-art.mjs` |
| `pug-body.png` | 9 | dùng — `ui/cat-art.mjs` |
| `pug-calm.png` | 6 | dùng — `ui/cat-art.mjs` |
| `pug-chew.png` | 5 | dùng — `ui/cat-art.mjs` |
| `pug-cute.png` | 9 | dùng — `ui/cat-art.mjs` |
| `pug-happy.png` | 4 | dùng — `ui/cat-art.mjs` |
| `pug-sleep.png` | 2 | dùng — `ui/cat-art.mjs` |
| `pug-sleepy.png` | 5 | dùng — `ui/cat-art.mjs` |
| `rottweiler-angry.png` | 7 | dùng — `ui/cat-art.mjs` |
| `rottweiler-body.png` | 7 | dùng — `ui/cat-art.mjs` |
| `rottweiler-calm.png` | 4 | dùng — `ui/cat-art.mjs` |
| `rottweiler-chew.png` | 4 | dùng — `ui/cat-art.mjs` |
| `rottweiler-cute.png` | 8 | dùng — `ui/cat-art.mjs` |
| `rottweiler-happy.png` | 4 | dùng — `ui/cat-art.mjs` |
| `rottweiler-sleep.png` | 2 | dùng — `ui/cat-art.mjs` |
| `rottweiler-sleepy.png` | 5 | dùng — `ui/cat-art.mjs` |
| `shiba-angry.png` | 6 | dùng — `ui/cat-art.mjs` |
| `shiba-body.png` | 12 | dùng — `ui/cat-art.mjs` |
| `shiba-calm.png` | 4 | dùng — `ui/cat-art.mjs` |
| `shiba-chew.png` | 4 | dùng — `ui/cat-art.mjs` |
| `shiba-cute.png` | 7 | dùng — `ui/cat-art.mjs` |
| `shiba-happy.png` | 6 | dùng — `ui/cat-art.mjs` |
| `shiba-sleep.png` | 2 | dùng — `ui/cat-art.mjs` |
| `shiba-sleepy.png` | 5 | dùng — `ui/cat-art.mjs` |

## farm-pop/ — Màn Farm-pop

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `background-pink.png` | 1209 | dùng — `ui/play/base.css`, `ui/shared/base.css` |
| `decor-sprites-mask.png` | 840 | dùng — `ui/play/base.css` |
| `decor-sprites.png` | 2520 | dùng — `ui/play/base.css` |
| `rotate-arrow.png` | 209 | dùng — `ui/play/base.css` |

## tutorial/ — Hướng dẫn (tutorial)

| File | KB | Trạng thái / nơi dùng |
|---|---|---|
| `gesture-pinch.png` | 50 | dùng — `app/deco-tour.js` |
| `gesture-rotate.png` | 54 | dùng — `app/deco-tour.js` |
| `hand-drag.png` | 46 | dùng — `app/deco-tour.js`, `play/tutorial.js` |
| `hand-tap.png` | 47 | dùng — `app/deco-tour.js`, `index.html`, `play/tutorial.js` |

