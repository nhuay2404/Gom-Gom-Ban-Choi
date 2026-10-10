// hc-kit facade: one object per game session. Owns persistence, rewards routing, analytics and ports;
// delegates every rule to the pure core. The game talks to it through 4 calls (requestStart, signal, levelEnd, continue*)
// and receives grants back through its adapter.
//
//   const liveops = createKit({ config, adapter, ports });
//   adapter = {
//     progress(): { cleared }                    levels cleared so far (unlocks daily / events)
//     grant(bundle, source)                      game part of a reward: game currencies + items
//     applyBuff?(buffs, { level, tier })         win-streak buffs at level start, e.g. { extraMoves: 2 }
//     resume?({ value, via, stuck, level })      continue after a loss (via: 'gems' | 'ad')
//   }
import * as core from './core.mjs';
import { systemClock, webStorage, nullAnalytics, mockAds, mockIap } from './platform/ports.mjs';

export { core };
export * as ports from './platform/ports.mjs';

export function createKit({ config, adapter, ports = {} }) {
  const clock = ports.clock ?? systemClock;
  const storage = ports.storage ?? webStorage();
  const ads = ports.ads ?? mockAds();
  const iap = ports.iap ?? mockIap();
  const analytics = ports.analytics ?? nullAnalytics;
  const storageKey = config.storageKey ?? `liveops:${config.gameId}`;
  const listeners = new Set();
  const now = () => clock.now();
  const cleared = () => adapter.progress().cleared;
  let attempt = { level: null, paid: 0, ad: 0 };

  function read() {
    let raw = null;
    try { raw = JSON.parse(storage.get(storageKey)); } catch {}
    if (raw && config.migrate) raw = config.migrate(raw);
    return core.loadState(raw, config, now());
  }
  let state = core.touchClock(read(), now(), config).state;

  function commit(next) {
    state = next;
    storage.set(storageKey, JSON.stringify(state));
    listeners.forEach(fn => fn(state));
  }
  const track = (name, props = {}) => analytics.track(name, { game: config.gameId, cleared: cleared(), ...props });

  // Route a reward: resolve random items, keep kit currencies / timers, hand the rest to the game.
  function grant(reward, source, rng) {
    if (core.isEmptyReward(reward)) return null;
    const resolved = core.resolveRandom(reward, rng);
    const { kit, game } = core.splitReward(resolved, config.currencies);
    commit(core.applyKitReward(state, kit, now()));
    if (!core.isEmptyReward(game)) adapter.grant(game, source);
    track('reward', { source, reward: resolved });
    return resolved;
  }
  const grantAll = list => list.map(r => ({ ...r, reward: grant(r.reward, r.label) }));
  const clockOk = () => !core.clockTampered(state, now(), (config.clockToleranceMin ?? 10) * 60 * 1000);

  const api = {
    get state() { return state; },
    config,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    wallet: id => state.wallet[id] ?? 0,

    // App open / back to home: record time, settle finished races.
    sync() {
      commit(core.touchClock(state, now(), config).state);
      const out = core.syncEvents(state, config, now());
      commit(out.state);
      return { rewards: grantAll(out.rewards), tampered: !clockOk() };
    },

    // ---------- Level lifecycle ----------
    // Call before entering a level. ok = false means no lives: show the lives UI and retry after a refill.
    requestStart(level) {
      const t = now();
      const intro = core.introLives(state, config, level, t);
      if (intro.granted) commit(intro.state);
      if (!core.canStart(state, config, level, t)) { track('lives_empty', { level }); return { ok: false, reason: 'no_lives', introMinutes: intro.granted }; }
      attempt = { level, paid: 0, ad: 0 };
      const tier = core.streakOn(config, level) ? core.streakTier(config, state.streak) : null;
      if (tier?.buffs) adapter.applyBuff?.(tier.buffs, { level, tier: tier.tier, streak: state.streak });
      const race = core.joinRaces(state, config, t, cleared(), level);
      commit(race.state);
      return { ok: true, introMinutes: intro.granted, streak: state.streak, tier, joinedRaces: race.joined, rewards: grantAll(race.rewards) };
    },

    // Gameplay signals: 'collect' { kind, amount, level } · 'action' { id, amount }. Feeds quests + collect events.
    signal(name, payload = {}) {
      const out = { completed: [], rewards: [], added: {} };
      if (core.dailyOn(config, cleared())) {
        const q = core.trackQuests(core.ensureQuests(state, config, now(), cleared()), config, now(), name, payload);
        commit(q.state);
        out.completed = q.completed;
        q.completed.forEach(quest => track('quest_complete', { id: quest.id }));
      }
      if (name === 'collect') {
        const ev = core.eventCollect(state, config, now(), cleared(), payload);
        commit(ev.state);
        out.added = ev.added;
        out.rewards = grantAll(ev.rewards);
      }
      return out;
    },

    // End of a level (win, loss after declining continue, or quit). Returns what changed for the result screen.
    levelEnd({ level, win, stars = 0, quit = false }) {
      const t = now(), before = core.regen(state, config, t);
      let next = win ? before : core.loseLife(before, config, level, t);
      next = core.recordStreak(next, config, level, win);
      commit(next);
      const lifeLost = !!config.lives && next.lives.n < before.lives.n;
      const streakLost = !win && before.streak > 0 && next.streak === 0;
      const quests = api.signal('level_end', { level, win, stars, quit });
      const ev = core.eventLevelEnd(state, config, t, cleared(), level, win);
      commit(ev.state);
      track('level_end', { level, win, stars, quit, lifeLost, streak: state.streak });
      return { lifeLost, streak: state.streak, streakLost, completed: quests.completed, rewards: grantAll(ev.rewards) };
    },

    // ---------- Continue ----------
    continueOffer(level) {
      if (!core.continueOn(config, level)) return null;
      const price = core.continuePrice(config, attempt.level === level ? attempt.paid : 0);
      const adLeft = (config.continue.ad?.perAttempt ?? 0) - (attempt.level === level ? attempt.ad : 0);
      const losing = [];
      if (core.livesOn(config, level) && !core.hasUnlimited(state, now())) losing.push({ id: 'life', n: 1 });
      if (core.streakOn(config, level) && state.streak > 0) losing.push({ id: 'streak', n: state.streak });
      return { price, affordable: !!core.spend(state, price), value: config.continue.value, ad: adLeft > 0 ? { value: config.continue.ad.value } : null, losing };
    },
    buyContinue({ level, stuck = false }) {
      const offer = api.continueOffer(level), paid = offer && core.spend(state, offer.price);
      if (!paid) return false;
      commit(paid);
      attempt = { ...attempt, level, paid: (attempt.level === level ? attempt.paid : 0) + 1 };
      track('continue_accept', { level, via: 'gems', price: offer.price });
      adapter.resume?.({ value: offer.value, via: 'gems', stuck, level });
      return true;
    },
    async adContinue({ level, stuck = false }) {
      const offer = api.continueOffer(level);
      if (!offer?.ad || !(await ads.rewarded('continue'))) return false;
      attempt = { ...attempt, level, ad: (attempt.level === level ? attempt.ad : 0) + 1 };
      track('ad_reward', { placement: 'continue', level });
      adapter.resume?.({ value: offer.ad.value, via: 'ad', stuck, level });
      return true;
    },

    // ---------- Lives ----------
    livesInfo: () => core.livesInfo(state, config, now()),
    refillLives() { const next = core.refill(state, config, now()); if (next) { commit(next); track('lives_refill'); } return !!next; },
    async adLife() {
      if (!(core.livesInfo(state, config, now())?.adsLeft > 0) || !(await ads.rewarded('life'))) return false;
      const next = core.adLife(state, config, now());
      if (next) { commit(next); track('ad_reward', { placement: 'life' }); }
      return !!next;
    },

    // ---------- Daily ----------
    dailyView() {
      if (!core.dailyOn(config, cleared())) return null;
      commit(core.ensureQuests(state, config, now(), cleared()));
      const quests = state.quests.list.map(q => ({ ...q, ...core.questDef(config, q.id), have: q.have, done: q.have >= q.need }));
      return { login: core.loginStatus(state, config, now()), quests, points: core.questPoints(state), goal: core.questGoal(config),
        chestReady: core.chestReady(state, config), chestOpened: !!state.quests.chest, chest: config.daily.quests.chest, msToReset: core.msToNextDay(now()), tampered: !clockOk() };
    },
    claimLogin() {
      const out = core.claimLogin(state, config, now());
      if (!out) return null;
      commit(out.state);
      track('daily_claim', { step: out.step });
      return { step: out.step, reward: grant(out.reward, `Login day ${out.step + 1}`) };
    },
    async claimChest({ ad = false, rng } = {}) {
      if (!core.chestReady(state, config)) return null;
      if (ad && !(await ads.rewarded('chest'))) return null;
      const out = core.claimChest(state, config, now());
      if (!out) return null;
      commit(out.state);
      track('chest_open', { ad });
      return { reward: grant(ad ? core.scaleReward(out.reward, 2) : out.reward, ad ? 'Chest x2' : 'Chest', rng) };
    },

    // ---------- Events ----------
    homeEvents: () => core.homeEvents(state, config, now(), cleared()),
    eventView(id) {
      const def = config.events?.defs[id], run = def && core.running(config, now(), cleared()).find(r => r.id === id);
      if (!def) return null;
      if (def.type === 'race') return core.raceStatus(state, config, id, now(), cleared());
      if (!run) return null;
      if (def.type === 'ladder') return core.ladderStatus(state, config, run);
      if (def.type === 'collect') return { ...core.collectStatus(state, config, run), adsLeft: core.adDoubleLeft(state, config, id, now()) };
      return { run, def };
    },
    async adDoubleCollect(id, count) {
      if (core.adDoubleLeft(state, config, id, now()) <= 0 || !(await ads.rewarded(`double:${id}`))) return null;
      const out = core.adDouble(state, config, now(), cleared(), id, count);
      if (!out) return null;
      commit(out.state);
      track('ad_reward', { placement: `double:${id}`, count });
      return { rewards: grantAll(out.rewards) };
    },
    markRaceSeen(id) { commit(core.markRaceSeen(state, id)); },
    saleOff: id => core.saleOff(config, now(), id),

    // ---------- Shop ----------
    async buyPack(id) {
      const pack = config.shop?.packs.find(p => p.id === id);
      if (!pack || !(await iap.buy(pack.sku ?? pack.id)).ok) return null;
      track('iap_purchase', { id, price: pack.price });
      return grant(pack.reward, `Pack ${id}`);
    },

    // Dev / QA only.
    _setState(next) { commit(core.loadState(next, config, now())); },
  };
  return api;
}
