/**
 * Non-interactive drizzle-kit push wrapper for CI environments.
 *
 * drizzle-kit push has interactive "suggestion" prompts that crash
 * in non-TTY environments. This wrapper catches the error and still
 * exits 0 — the schema changes that DON'T require suggestions are
 * applied before the prompt appears.
 *
 * For suggestion-type changes (unique constraints on populated tables),
 * they must be applied manually via ALTER TABLE SQL.
 */
import { execSync } from 'node:child_process';

const extraArgs = process.argv.slice(2);
const cmd = `npx drizzle-kit push --force ${extraArgs.join(' ')}`.trim();

try {
  execSync(cmd, {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, FORCE_COLOR: '0' },
    timeout: 60_000,
    input: 'no\nno\nno\nno\nno\n', // auto-answer truncation prompts
  });
  console.log('✅ db:push succeeded');
} catch (err) {
  const exitCode = err.status ?? 1;
  const stderr = err.stderr?.toString() ?? '';
  // drizzle-kit exits non-zero on interactive prompt failure — this is expected in CI
  if (stderr.includes('Interactive prompts require a TTY') || stderr.includes('isTTY')) {
    console.log('✅ db:push completed (interactive prompts skipped — apply constraint changes manually if needed)');
    process.exit(0);
  }
  console.log(`⚠️ db:push exited with code ${exitCode}`);
  process.exit(exitCode);
}
