/**
 * Federation seed script — creates test data for two-instance federation testing.
 *
 * Usage:
 *   npx tsx deploy/federation-seed.ts
 *
 * Prerequisites:
 *   docker compose -f deploy/docker-compose.federation.yml up -d
 *
 * Creates:
 *   Instance A (port 5433): alice user, published article, OAuth client for B
 *   Instance B (port 5434): bob user, published article, OAuth client for A
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@commonpub/schema';
import { randomUUID } from 'node:crypto';

const INSTANCE_A = {
  domain: 'a.localhost:3001',
  dbUrl: 'postgresql://commonpub:commonpub_dev@localhost:5433/commonpub_a',
};

const INSTANCE_B = {
  domain: 'b.localhost:3002',
  dbUrl: 'postgresql://commonpub:commonpub_dev@localhost:5434/commonpub_b',
};

async function seed(instanceConfig: typeof INSTANCE_A, peerConfig: typeof INSTANCE_B) {
  const pool = new pg.Pool({ connectionString: instanceConfig.dbUrl });
  const db = drizzle(pool, { schema });

  const userId = randomUUID();
  const username = instanceConfig === INSTANCE_A ? 'alice' : 'bob';
  const displayName = instanceConfig === INSTANCE_A ? 'Alice Maker' : 'Bob Builder';

  // Create user
  await db
    .insert(schema.users)
    .values({
      id: userId,
      email: `${username}@${instanceConfig.domain}`,
      emailVerified: true,
      username,
      displayName,
      role: 'admin',
      status: 'active',
    })
    .onConflictDoNothing();

  // Create published content
  await db
    .insert(schema.contentItems)
    .values({
      authorId: userId,
      type: 'article',
      title: `${displayName}'s First Article`,
      slug: `${username}-first-article`,
      description: `An article by ${displayName} for federation testing`,
      content: `<p>Hello from ${instanceConfig.domain}!</p>`,
      status: 'published',
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  // Register OAuth client for peer instance
  const clientId = `https://${peerConfig.domain}`;
  const clientSecret = randomUUID();

  await db
    .insert(schema.oauthClients)
    .values({
      clientId,
      clientSecret,
      redirectUris: [`https://${peerConfig.domain}/api/auth/oauth2/callback`],
      instanceDomain: peerConfig.domain,
    })
    .onConflictDoNothing();

  console.log(`Seeded ${instanceConfig.domain}:`);
  console.log(`  User: ${username} (${userId})`);
  console.log(`  OAuth client for ${peerConfig.domain}: ${clientId}`);

  await pool.end();
}

async function main() {
  console.log('Federation seed script\n');

  await seed(INSTANCE_A, INSTANCE_B);
  await seed(INSTANCE_B, INSTANCE_A);

  console.log('\nDone! Start instances with:');
  console.log(
    '  Instance A: PUBLIC_DOMAIN=a.localhost:3001 DATABASE_URL=postgresql://commonpub:commonpub_dev@localhost:5433/commonpub_a FEATURE_FEDERATION=true pnpm --filter reference dev -- --port 3001',
  );
  console.log(
    '  Instance B: PUBLIC_DOMAIN=b.localhost:3002 DATABASE_URL=postgresql://commonpub:commonpub_dev@localhost:5434/commonpub_b FEATURE_FEDERATION=true pnpm --filter reference dev -- --port 3002',
  );
}

main().catch(console.error);
