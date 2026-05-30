#!/usr/bin/env node
/**
 * Post-deploy smoke test. Run INSIDE the app container via:
 *   docker compose -f docker-compose.prod.yml exec -T app node scripts/smoke.mjs
 *
 * Why in-container: the app listens on localhost:3000 INSIDE its container
 * (see the Dockerfile HEALTHCHECK), but that port is NOT published to the
 * droplet host — caddy fronts 80/443. So a host-level `curl localhost:3000`
 * never reaches the app (it just times out), which is why the old health
 * check silently never worked: it was `curl … || echo ::warning`, so a
 * permanently-unreachable probe still "passed". Running from inside the
 * container is the one place localhost:3000 is guaranteed to be the app.
 *
 * What it does, and why it matters: waits for /api/health to come up
 * (generous 120s window — a freshly-loaded image cold-starts Nuxt SSR +
 * DB/redis/meili pools), THEN verifies the CRITICAL ROUTES — including `/`,
 * the homepage. A public page can 500 during SSR while /api/health stays
 * 200 (session 169: the homepage layout-engine canary crashed with "DnD
 * provider not found" yet a health-only smoke reported the deploy a
 * success). Exits non-zero if any critical route serves non-2xx, so a down
 * page FAILS the deploy visibly instead of hiding behind a healthy
 * /api/health.
 *
 * SMOKE_BASE overrides the base URL (default http://localhost:3000) so the
 * exact same logic can be dry-run against the live site from a workstation:
 *   SMOKE_BASE=https://commonpub.io node scripts/smoke.mjs
 */

const BASE = process.env.SMOKE_BASE || 'http://localhost:3000';
const HEALTH_TRIES = 40; // × 3s = 120s startup window
const ROUTE_TRIES = 4; //   × 3s = 12s per route once health is up
const STEP_MS = 3000;
const CRITICAL_ROUTES = ['/', '/api/health'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch a path, returning the HTTP status (0 on network error). */
async function status(path) {
  try {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    return res.status;
  } catch {
    return 0;
  }
}

const ok = (code) => code >= 200 && code < 400;

async function main() {
  // 1. Startup gate — poll /api/health until the app answers.
  let up = false;
  for (let i = 0; i < HEALTH_TRIES; i++) {
    if (ok(await status('/api/health'))) {
      up = true;
      console.log(`✅ Health endpoint responding after ${i * (STEP_MS / 1000)}s`);
      break;
    }
    await sleep(STEP_MS);
  }
  if (!up) {
    console.error(`::error::App did not become healthy within ${(HEALTH_TRIES * STEP_MS) / 1000}s of startup`);
    process.exit(1);
  }

  // 2. Critical-route smoke — hard-fail on any non-2xx/3xx.
  let failed = false;
  for (const route of CRITICAL_ROUTES) {
    let code = 0;
    for (let a = 0; a < ROUTE_TRIES; a++) {
      code = await status(route);
      if (ok(code)) break;
      await sleep(STEP_MS);
    }
    if (ok(code)) {
      console.log(`✅ ${route} -> ${code}`);
    } else {
      console.error(`::error::Smoke FAILED: ${route} returned ${code}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('::error::Post-deploy smoke failed — the new image is live but serving errors on a critical route. Investigate immediately (consider redeploying the previous SHA).');
    process.exit(1);
  }
  console.log('✅ Post-deploy smoke passed.');
}

main().catch((e) => {
  console.error(`::error::Smoke script crashed: ${e?.message ?? e}`);
  process.exit(1);
});
