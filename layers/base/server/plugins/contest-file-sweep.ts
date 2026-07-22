/**
 * Orphaned private-contest-file sweeper (session-244 post-roll hardening).
 *
 * A purpose=`contest` private upload is stored the moment a user picks a file in a
 * registration/entry form — BEFORE the form is submitted. If they never submit (or
 * later unregister/withdraw, or the contest is deleted), the file bytes have no
 * cleanup path: the delete guard only blocks referenced files, and DB cascades never
 * reach object storage. This worker deletes such abandoned private files older than
 * the grace window, bounding storage growth + honouring erasure once a reference is
 * gone. "Referenced" uses the same `user_id = uploader_id` invariant as the /raw
 * scoping, so a smuggled cross-user reference never protects a file from the sweep.
 *
 * Gated on `contestPrivateFiles` (inert otherwise). Idempotent + re-entrancy-guarded;
 * safe on multiple replicas (each candidate's byte-delete + row-delete is independent).
 */
import { sweepOrphanedContestFiles } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  // Hourly is ample: abandoned files are not time-critical, and the grace window
  // (below) is far longer than any real upload→submit gap.
  const INTERVAL_MS = 3_600_000;
  // Grace period before an unreferenced private file is swept. Generous so a slow
  // form fill / a save-later flow is never caught; still bounds accumulation.
  const GRACE_MS = 48 * 3_600_000;
  const LIMIT = 200;

  let interval: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const startupTimer = setTimeout(() => {
    try {
      console.log(`[contest-file-sweep] worker started (interval: ${INTERVAL_MS}ms)`);
      void runSweep();
      interval = setInterval(() => void runSweep(), INTERVAL_MS);
    } catch (err) {
      console.error('[contest-file-sweep] worker failed to start:', err instanceof Error ? err.message : err);
    }
  }, 24_000);

  async function runSweep(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const config = useConfig();
      if (!config.features.contestPrivateFiles) return; // inert unless the feature is on

      const adapter = useFileStorage();
      const result = await sweepOrphanedContestFiles(
        useDB(),
        (key) => adapter.deletePrivate(key),
        { olderThanMs: GRACE_MS, limit: LIMIT },
      );
      if (result.swept > 0) {
        console.log(`[contest-file-sweep] deleted ${result.swept} abandoned private contest file(s)`);
      }
    } catch (err) {
      console.error('[contest-file-sweep] sweep error:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  }

  nitro.hooks.hook('close', () => {
    clearTimeout(startupTimer);
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  });
});
