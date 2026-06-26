// Backward-compatible barrel for the email subsystem (split into ./email/* in
// session 227). Keeps the package's `./email` export + the @commonpub/server
// re-export stable. See ./email/index.ts.
export * from './email/index.js';
