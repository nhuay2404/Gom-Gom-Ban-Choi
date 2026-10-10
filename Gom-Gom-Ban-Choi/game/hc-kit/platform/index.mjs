// Platform module: shared by every other module. Save document, clock helpers + rollback guard, reward bundles, ports.
// Imports nothing from monetization/ or liveops/ (test/boundaries.test.mjs).
export * from './time.mjs';
export * from './rewards.mjs';
export * from './state.mjs';
