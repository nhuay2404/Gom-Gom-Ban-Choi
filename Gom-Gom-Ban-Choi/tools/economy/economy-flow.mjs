// Mô hình dòng xu kiểu Machinations cho tab Kinh tế → Sơ đồ dòng xu. Mỗi bước = thắng thêm một màn (tất định, không ngẫu nhiên):
// Source (xu ban đầu, thắng màn, mèo idle) → Pool (ví) → Gate (mở khu, trả giá mở) → Sink (mua đồ của khu đó, rẻ trước).
// Luật tiêu giống người ảo kiểu "mua đồ mặc định" ở economy-sim.mjs: tới màn mốc khu kế mà chưa đủ xu mở khu thì để dành, chưa mua đồ.
// in: { start, levels, reward(i), idle(i) (xu idle nhận trong bước thắng màn i + 1), gates: { area: { level, cost } }, order: [area...],
//       items: [{ area, price, open }] (open = màn sớm nhất mua được, như openLevel) }
// out: steps[k] = trạng thái sau khi thắng k màn: { wallet, gain: { start, win, idle }, pay: { area: { gate, deco } }, opened: [area], owned, tot }
export function runFlow({ start, levels, reward, idle, gates, order, items }) {
  const shop = [...items].sort((a, b) => a.price - b.price), owned = new Set(), opened = new Set(['garden']);
  const tot = { start, win: 0, idle: 0, pay: {} };
  let wallet = start;
  const steps = [{ wallet, gain: { start, win: 0, idle: 0 }, pay: {}, opened: [...opened], owned: 0, tot: structuredClone(tot) }];
  const add = (pay, area, kind, v) => {
    (pay[area] ??= { gate: 0, deco: 0 })[kind] += v;
    (tot.pay[area] ??= { gate: 0, deco: 0 })[kind] += v;
  };
  for (let k = 1; k <= levels; k++) {
    const win = reward(k - 1), got = idle(k - 1), pay = {};
    wallet += win + got; tot.win += win; tot.idle += got;
    for (const area of order) {
      if (opened.has(area)) continue;
      const gate = gates[area];
      if (k < gate.level || wallet < gate.cost) break;
      wallet -= gate.cost; opened.add(area); add(pay, area, 'gate', gate.cost);
    }
    const waiting = order.find(area => !opened.has(area) && k >= gates[area].level);
    if (!waiting) for (const [i, item] of shop.entries()) {
      if (owned.has(i) || !opened.has(item.area) || item.open > k + 1) continue;
      // Danh sách xếp theo giá: món này không đủ xu thì món sau cũng không.
      if (wallet < item.price) break;
      wallet -= item.price; owned.add(i); add(pay, item.area, 'deco', item.price);
    }
    steps.push({ wallet, gain: { start: 0, win, idle: got }, pay, opened: [...opened], owned: owned.size, tot: structuredClone(tot) });
  }
  return steps;
}
