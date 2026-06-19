// Back-compat shim — the former monolith was split per-domain into
// `./validators/` (audit-203). Every export still resolves through here so
// `@commonpub/schema`'s index.ts and all consumers import unchanged.
export * from './validators/index.js';
