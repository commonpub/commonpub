/**
 * Email subsystem barrel. Split from a former single `email.ts` monolith into
 * types / adapters / render / templates (session 227). The render helpers stay
 * module-private (only `templates.ts` imports them) — nothing outside this dir
 * emits email HTML. `src/email.ts` re-exports this so the package's `./email`
 * entry point is unchanged.
 */
export * from './types.js';
export * from './adapters.js';
export { emailTemplates } from './templates.js';
