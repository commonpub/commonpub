/**
 * Persona audience rollup worker (plan 7.3, 7.6).
 *
 * PERSONA OWNS ITS OWN ROLLUP. This plugin calls `runPersonaRollup`, which writes
 * to `persona_metrics_daily`. It does not touch `runDailyRollup`, it does not
 * write a row into `metrics_daily`, and it never registers a series in
 * `TIMESERIES_METRICS` (plan 14.4). That is not tidiness: `/metrics/timeseries`
 * is guarded by `read:analytics` alone, which a `read:*` key satisfies, so a
 * persona row in the shared table would be reachable around every gate this
 * feature adds — the new scope, its wildcard protection, both feature flags and
 * both k-anonymity floors. An own table means that back door never exists.
 *
 * WHY A ROLLUP AT ALL. Suppression and quantisation are applied at WRITE, so the
 * stored day never holds a re-identifying count and the series cannot be
 * differenced across days to recover a small bucket. The public endpoints then
 * serve a finalised day rather than live SQL, which is what stops a caller
 * polling hourly to watch a bucket cross the floor from below.
 *
 * Scheduling mirrors `metrics-rollup.ts` (post-boot delay, then every 6h), with
 * three differences:
 *
 * - it staggers AFTER that worker so two aggregate passes do not start together;
 * - it gates on `features.persona` and `features.personaAnalytics` as well as
 *   `features.publicApi`, and it re-checks them on EVERY run rather than only at
 *   startup, so an operator turning the feature off stops the pass without a
 *   redeploy;
 * - `runPersonaRollup` also closes out yesterday. The existing worker only ever
 *   upserts today and never writes a "yesterday is final" row, so without that
 *   step the public endpoints would have nothing to serve.
 *
 * Two behaviours worth stating out loud, both from plan 7.6: day keys are UTC
 * everywhere, and the worker skips entirely when `publicApi` is off, so history
 * is missing on an instance that enables the API later.
 */
import { runPersonaRollup, utcDayKey } from '@commonpub/server';

// Relative, not auto-imported: a Nitro plugin does not auto-import from `utils/`.
import { personaMetricsContext } from '../utils/personaMetricsContext';


const ROLLUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h; refreshes today, finalises yesterday
const STARTUP_DELAY_MS = 25_000; // after metrics-rollup's 15s, after federation/registry

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      if (!enabled()) return;
      console.log(`[persona-rollup] worker started (interval: ${ROLLUP_INTERVAL_MS}ms)`);
      void runRollup();
      interval = setInterval(() => void runRollup(), ROLLUP_INTERVAL_MS);
    } catch (err) {
      console.error('[persona-rollup] failed to start:', err instanceof Error ? err.message : err);
    }
  }, STARTUP_DELAY_MS);

  function enabled(): boolean {
    const config = useConfig();
    // publicApi: the endpoints that consume the snapshot live under /api/public.
    // persona + personaAnalytics: the feature and its analytics half are separate
    // flags because collecting answers and aggregating them are different risks.
    // dataSharingConsents: the pass counts nothing BUT purpose grants, and that
    // flag governs the surface where a member gives and withdraws them. Without
    // this line an operator could switch off the disclosing surface and leave
    // the counting running on grants nobody could then manage, which is the
    // shape Art. 7(3) exists to prevent. Counting dies with its consent surface.
    return (
      config.features.publicApi === true &&
      config.features.persona === true &&
      config.features.personaAnalytics === true &&
      config.features.dataSharingConsents === true
    );
  }

  async function runRollup(): Promise<void> {
    try {
      // Re-read the flags every run: a startup-only check would keep aggregating
      // for up to 6 hours after an operator switched the feature off.
      if (!enabled()) return;

      const db = useDB();
      const config = useConfig();
      const day = utcDayKey();

      // The SAME resolution the read routes use, from one helper. Writing a
      // field the routes would refuse to serve would put a bucket in the table
      // that no gate above ever agreed to, and a digest resolved differently
      // here would store rows the routes then cannot match.
      const { fields, platforms, scope, thresholds } = await personaMetricsContext(db, config);

      const result = await runPersonaRollup(db, {
        day,
        fields,
        platforms,
        thresholds,
        offeredPurposes: scope.offerablePurposes.map((purpose) => ({
          purpose,
          scopeDigest: scope.digest,
        })),
      });

      const finalised =
        result.finalisedDay === null
          ? ''
          : `, finalised ${result.finalisedDay} (${result.finalisedRows} rows)`;
      console.log(`[persona-rollup] ${result.day}: ${result.rowsWritten} rows${finalised}`);
    } catch (err) {
      console.error('[persona-rollup] run error:', err instanceof Error ? err.message : err);
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
