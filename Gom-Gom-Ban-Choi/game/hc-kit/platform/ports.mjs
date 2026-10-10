// Ports: the only places the kit touches the outside world. Each platform (web, TikTok Mini Game, Cocos native, store build)
// provides its own implementation with the same shape. Mocks here are for prototypes and tests.
//
//   clock      { now(): ms }
//   storage    { get(key): string | null, set(key, string) }
//   ads        { rewarded(placement): Promise<boolean> }            true = reward earned
//   iap        { buy(sku): Promise<{ ok: boolean }> }
//   analytics  { track(name, props) }

export const systemClock = { now: () => Date.now() };

// Fixed / steppable clock for tests and QA.
export function manualClock(start) {
  let t = start;
  return { now: () => t, set: ms => { t = ms; }, advance: ms => { t += ms; } };
}

// Any object with getItem / setItem: window.localStorage, Cocos sys.localStorage, a TikTok setStorageSync wrapper.
export function webStorage(backend = globalThis.localStorage) {
  const memory = new Map();
  return {
    get: key => { try { const v = backend?.getItem(key); if (v != null) return v; } catch {} return memory.get(key) ?? null; },
    set: (key, value) => { memory.set(key, value); try { backend?.setItem(key, value); } catch {} },
  };
}

export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { get: key => map.get(key) ?? null, set: (key, value) => map.set(key, value), dump: () => Object.fromEntries(map) };
}

// Simulated rewarded ad. `decide(placement)` lets a game show its own "test ad" UI and resolve true / false.
export function mockAds(decide = async () => true) {
  return { rewarded: placement => Promise.resolve(decide(placement)) };
}

// Simulated purchases (prototype builds must label them as test purchases in the UI).
export function mockIap(decide = async () => ({ ok: true })) {
  return { buy: sku => Promise.resolve(decide(sku)) };
}

export const nullAnalytics = { track() {} };
export function memoryAnalytics() {
  const events = [];
  return { events, track: (name, props) => events.push({ name, props }) };
}
