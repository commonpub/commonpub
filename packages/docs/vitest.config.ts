import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60000,
    // CI-only retry. These tests are pure-logic and deterministic locally
    // (pass repeatedly + shuffled), but intermittently fail in CI where every
    // package's suite runs in parallel under turbo on a shared runner — a
    // transient worker stall/crash, not a real assertion failure. Retries
    // recover the transient case without masking a genuine bug (a real failure
    // fails all attempts). 0 retries locally so flakiness still surfaces in dev.
    retry: process.env.CI ? 2 : 0,
    // Forks, not the default threads: the markdown pipeline suite is CPU-bound
    // (60s+ on a loaded runner) and starves the worker thread's event loop, so
    // vitest's birpc "onTaskUpdate" call times out and the run fails with an
    // Unhandled Error even when all tests PASS (retry doesn't cover run-level
    // errors — it hit CI twice on 2026-06-09). Process isolation keeps the
    // RPC channel responsive under that load.
    pool: 'forks',
  },
});
