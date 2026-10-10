// Monetization module (always on, not scheduled; the game's own economy - soft currency, prices, sinks - stays in the game): lives, continue, win streak. Wallet + shop packs go through
// platform/state.mjs and the facade. Imports only platform/.
export * from './lives.mjs';
export * from './play.mjs';
