#!/usr/bin/env node
/**
 * One-shot CLI: migrate `instance_settings.homepage.sections` to a
 * `layouts` row for scope ('route', '/').
 *
 * Wraps `migrateHomepageSectionsToLayout` from @commonpub/server with a
 * thin node-postgres adapter, so operators can run this from inside the
 * app container without holding an admin session:
 *
 *   docker exec commonpub-app-1 node scripts/migrate-homepage-layout.mjs
 *
 * Or with --force to replace an existing layout:
 *
 *   docker exec commonpub-app-1 node scripts/migrate-homepage-layout.mjs --force
 *
 * Idempotent by default — re-running without --force is safe.
 *
 * Why a script + not just curl the admin endpoint:
 *   - Curl path needs admin auth (better-auth session cookie). For a
 *     canary the operator already has SSH; skipping auth removes one
 *     prerequisite.
 *   - Script runs inside the container with the live DATABASE_URL; no
 *     cross-network port forwarding for psql or curl.
 *   - Same outcome as POST /api/admin/layouts/migrate-homepage; that
 *     endpoint stays available for admin-UI / future "re-run" affordance.
 *
 * Reads NUXT_DATABASE_URL or DATABASE_URL (matches db-migrate.mjs).
 */
// Import via the subpath export — `@commonpub/server` (the index entry)
// pulls in @commonpub/infra + @commonpub/auth + @commonpub/protocol
// transitively, none of which are present in the runtime image's
// /app/node_modules. The `./layout/migrate-homepage` deep path has a
// clean dep chain: drizzle-orm + @commonpub/schema only (both available).
import { migrateHomepageSectionsToLayout } from '@commonpub/server/layout/migrate-homepage';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@commonpub/schema';
import pg from 'pg';

const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('❌ migrate-homepage-layout requires NUXT_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

const force = process.argv.includes('--force');

const pool = new pg.Pool({ connectionString: url, max: 2 });
const db = drizzle(pool, { schema });

try {
  const result = await migrateHomepageSectionsToLayout(db, { force });

  if (result.migrated) {
    console.log('✅ Migrated legacy homepage.sections to layout:');
    console.log(`   layoutId: ${result.layoutId}`);
    console.log(`   sections converted: ${result.sectionsConverted}`);
    if (result.sectionsSkipped > 0) {
      console.log(`   sections skipped: ${result.sectionsSkipped}`);
      console.log(`   skipReasons: ${JSON.stringify(result.skipReasons)}`);
    }
  } else {
    console.log(`⏭  Skipped: ${result.reason}`);
    if (result.layoutId) console.log(`   existing layoutId: ${result.layoutId}`);
    if (result.reason === 'layout-already-exists') {
      console.log('   Use --force to replace the existing layout.');
    }
  }
} catch (err) {
  console.error('❌ migrate-homepage-layout failed:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
} finally {
  await pool.end();
}
