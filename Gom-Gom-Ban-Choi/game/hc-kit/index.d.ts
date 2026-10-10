// hc-kit public contract: config, adapter, ports and the facade returned by createKit().
// This file is the handover surface for dev teams (Cocos TypeScript / backend). The runtime is plain JS (.mjs);
// these types describe it and must change together with it (see docs/INTEGRATION.md, "Quy tắc sửa kit").

// ---------- Rewards ----------
/** One shape for every source (login, chest, event, race, pack). Any extra numeric key is a currency id. */
export interface Reward {
  items?: Record<string, number>;
  /** Kit-owned timers in minutes. Only `unlimitedLives` is understood by the core. */
  timers?: Record<string, number>;
  /** Resolved by the kit into `items` before granting. */
  random?: { pool: string[]; n?: number };
  [currency: string]: number | Record<string, number> | { pool: string[]; n?: number } | undefined;
}
/** Price in kit-owned currencies, e.g. `{ gems: 60 }`. */
export type Price = Record<string, number>;
export interface GrantedReward { eventId?: string; label: string; reward: Reward | null; big?: boolean }

// ---------- Config (one per game; numbers belong to the game designer) ----------
export interface CurrencyDef {
  /** 'kit' = stored and spent by the kit (hard currency, e.g. gems). 'game' = handed to adapter.grant(). */
  owner: 'kit' | 'game';
  start?: number;
}
export interface LivesConfig {
  max: number;
  regenMin: number;
  /** Lives are lost from this level on (levels start at 1). */
  fromLevel: number;
  introUnlimitedMin?: number;
  refill: Price;
  adPerDay?: number;
}
export interface ContinueConfig {
  fromLevel?: number;
  /** Price of the 1st, 2nd, 3rd+ paid continue within one attempt. */
  prices: Price[];
  /** Meaning is game-specific (moves, tiles, revive). Passed to adapter.resume(). */
  value: number;
  ad?: { perAttempt: number; value: number };
}
export interface StreakConfig {
  fromLevel?: number;
  /** Buff ids are game-specific; the kit passes them to adapter.applyBuff(). */
  tiers: { wins: number; buffs: Record<string, number> }[];
}
export interface QuestMatch { signal: 'collect' | 'action' | 'level_end'; minAmount?: number; minStars?: number; [field: string]: unknown }
export interface QuestDef {
  id: string;
  text: string;
  need: number;
  /** 'signals' (default) counts signals, 'amount' sums payload.amount. */
  count?: 'signals' | 'amount';
  fromCleared?: number;
  match: QuestMatch;
}
export interface DailyConfig {
  fromCleared?: number;
  login: Reward[];
  quests: {
    /** One quest per tier per day; points per tier sum to the chest goal. */
    slots: Record<string, number>;
    pool: Record<string, QuestDef[]>;
    chest: Reward;
  };
}
interface EventBase { name: string; fromLevel?: number }
export interface LadderEvent extends EventBase { type: 'ladder'; steps: number; stepRewards?: Record<number, Reward>; top: Reward; repeatTop?: Reward }
export interface CollectEvent extends EventBase {
  type: 'collect';
  collect: { kind: string; per?: number };
  milestones: { at: number; reward: Reward }[];
  adDoublePerDay?: number;
}
export interface RaceEvent extends EventBase {
  type: 'race';
  goal: number;
  hours: number;
  /** AI rivals: wins within `hours`, [min, max]. UI must label them as AI. */
  bots: [number, number][];
  botNames: string[];
  /** By rank, 1st first. */
  rewards: Reward[];
}
export interface SaleEvent extends EventBase { type: 'sale'; /** 0..1 */ off: number }
export type EventDef = LadderEvent | CollectEvent | RaceEvent | SaleEvent;
export interface CalendarEntry {
  id: string;
  slot: 'main' | 'side' | 'offer';
  /** 0 = Monday ... 6 = Sunday. Consecutive days form one run. */
  weekdays: number[];
  /** Weeks of the cycle (1..4); omitted = every week. */
  weeks?: number[];
}
export interface EventsConfig {
  epoch: { year: number; month: number; day: number };
  cycleDays: number;
  calendar: CalendarEntry[];
  defs: Record<string, EventDef>;
}
export interface ShopPack { id: string; sku?: string; price: string; reward: Reward; tag?: string }

export interface KitConfig {
  gameId: string;
  /** Default `liveops:<gameId>`. Keep an old key to preserve existing saves. */
  storageKey?: string;
  migrate?: (oldSave: any) => KitState;
  clockToleranceMin?: number;
  currencies: Record<string, CurrencyDef>;
  // Monetization module (null / omitted = off). The game's own economy (soft currency, prices) is not part of the kit.
  lives?: LivesConfig | null;
  continue?: ContinueConfig | null;
  streak?: StreakConfig | null;
  shop?: { packs: ShopPack[] } | null;
  // LiveOps module (null / omitted = off)
  daily?: DailyConfig | null;
  events?: EventsConfig | null;
}

// ---------- Adapter (one per game: the only game code the kit calls) ----------
export interface KitAdapter {
  /** Levels cleared so far; unlocks daily and events. */
  progress(): { cleared: number };
  /** Game part of a reward: game currencies + items. `source` is a display label. */
  grant(bundle: Reward, source: string): void;
  /** Required when config.streak is set. */
  applyBuff?(buffs: Record<string, number>, info: { level: number; tier: number; streak: number }): void;
  /** Required when config.continue is set. */
  resume?(info: { value: number; via: 'gems' | 'ad'; stuck: boolean; level: number }): void;
}

// ---------- Ports (one per platform; the backend seam) ----------
// PRODUCTION: clock, iap and the kit wallet must become server-authoritative before a real-money launch
// (see docs/INTEGRATION.md, "Bàn giao production"). The mocks below are for prototypes only.
export interface ClockPort { now(): number }
export interface StoragePort { get(key: string): string | null; set(key: string, value: string): void }
export interface AdsPort { rewarded(placement: string): Promise<boolean> }
export interface IapPort { buy(sku: string): Promise<{ ok: boolean }> }
export interface AnalyticsPort { track(name: string, props: Record<string, unknown>): void }
export interface KitPorts { clock?: ClockPort; storage?: StoragePort; ads?: AdsPort; iap?: IapPort; analytics?: AnalyticsPort }

// ---------- Saved state (one JSON document per game) ----------
export interface KitState {
  v: number;
  wallet: Record<string, number>;
  lives: { n: number; regenFrom: number | null; unlimitedUntil: number; intro: boolean; ads: { day: string | null; used: number } };
  /** Highest clock value ever seen (rollback guard). */
  maxSeen: number;
  login: { claimed: number; lastDay: string | null };
  quests: { day: string; list: { id: string; tier: string; points: number; have: number; need: number }[]; chest: boolean } | null;
  streak: number;
  events: Record<string, any>;
}

// ---------- Facade ----------
export interface LevelEndResult { lifeLost: boolean; streak: number; streakLost: boolean; completed: { id: string }[]; rewards: GrantedReward[] }
export interface ContinueOfferView {
  price: Price;
  affordable: boolean;
  value: number;
  ad: { value: number } | null;
  /** What the player loses by giving up, for the offer UI. */
  losing: { id: 'life' | 'streak'; n: number }[];
}
export interface LivesView { lives: number; max: number; nextMs: number; unlimitedMs: number; canPlay: boolean; adsLeft: number; refill: Price }

export interface Kit {
  readonly state: KitState;
  readonly config: KitConfig;
  on(listener: (state: KitState) => void): () => void;
  wallet(currency: string): number;
  /** Call on app open and back to Home: records time, settles finished races. */
  sync(): { rewards: GrantedReward[]; tampered: boolean };

  // Level loop
  requestStart(level: number): { ok: false; reason: 'no_lives'; introMinutes: number }
    | { ok: true; introMinutes: number; streak: number; tier: { wins: number; buffs: Record<string, number>; tier: number } | null; joinedRaces: string[]; rewards: GrantedReward[] };
  signal(name: 'collect', payload: { kind: string; amount: number; level: number }): { completed: { id: string }[]; rewards: GrantedReward[]; added: Record<string, number> };
  signal(name: 'action', payload: { id: string; amount?: number }): { completed: { id: string }[]; rewards: GrantedReward[]; added: Record<string, number> };
  /** Only once the attempt is really over (after a declined continue). */
  levelEnd(result: { level: number; win: boolean; stars?: number; quit?: boolean }): LevelEndResult;

  // Monetization
  continueOffer(level: number): ContinueOfferView | null;
  buyContinue(args: { level: number; stuck?: boolean }): boolean;
  adContinue(args: { level: number; stuck?: boolean }): Promise<boolean>;
  livesInfo(): LivesView | null;
  refillLives(): boolean;
  adLife(): Promise<boolean>;
  buyPack(id: string): Promise<Reward | null>;

  // LiveOps
  dailyView(): any | null;
  claimLogin(): { step: number; reward: Reward | null } | null;
  claimChest(options?: { ad?: boolean; rng?: () => number }): Promise<{ reward: Reward | null } | null>;
  homeEvents(): { id: string; type: EventDef['type']; slot: 'main' | 'side'; end: number }[];
  eventView(id: string): any | null;
  adDoubleCollect(id: string, count: number): Promise<{ rewards: GrantedReward[] } | null>;
  markRaceSeen(id: string): void;
  /** Discount 0..1 of a running sale; the game applies it to its own prices. */
  saleOff(id: string): number;

  /** Dev / QA only. */
  _setState(next: KitState): void;
}

export function createKit(args: { config: KitConfig; adapter: KitAdapter; ports?: KitPorts }): Kit;
export * as core from './core.mjs';
export * as ports from './platform/ports.mjs';
