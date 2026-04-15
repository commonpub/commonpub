/**
 * Non-interactive drizzle-kit migrate wrapper for CI environments.
 *
 * Unlike db-push.mjs (which uses drizzle-kit push --force), this script
 * applies committed migration files via drizzle-kit migrate. This is the
 * production-safe approach: migrations are reviewed in PRs before deploy.
 *
 * Usage: node scripts/db-migrate.mjs [--config=drizzle.config.js]
 *
 * Workflow:
 * 1. Developer changes schema .ts files
 * 2. Developer runs `npx drizzle-kit generate` locally (requires TTY)
 * 3. Developer commits the generated .sql migration files
 * 4. PR review includes the migration SQL
 * 5. CI deploy runs this script to apply pending migrations
 */
import { execSync } from 'node:child_process';

const extraArgs = process.argv.slice(2);
const cmd = `npx drizzle-kit migrate ${extraArgs.join(' ')}`.trim();

try {
  execSync(cmd, {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, FORCE_COLOR: '0' },
    timeout: 120_000,
  });
  console.log('✅ db:migrate succeeded');
} catch (err) {
  const exitCode = err.status ?? 1;
  const stderr = err.stderr?.toString() ?? '';

  // If no pending migrations, drizzle-kit may exit with a message but code 0
  if (stderr.includes('Nothing to migrate') || stderr.includes('already applied')) {
    console.log('✅ db:migrate — no pending migrations');
    process.exit(0);
  }

  console.error(`❌ db:migrate failed with exit code ${exitCode}`);
  console.error('Migration may have partially applied. Check the database state.');
  process.exit(exitCode);
}
