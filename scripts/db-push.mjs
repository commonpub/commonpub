/**
 * Non-interactive drizzle-kit push wrapper for CI environments.
 *
 * drizzle-kit push --force skips "apply changes?" prompts but NOT
 * "do you want to truncate?" suggestion prompts. Those check
 * process.stdin.isTTY and crash in CI. This wrapper fakes isTTY
 * and auto-answers "no" to all truncation suggestions.
 *
 * Usage: node scripts/db-push.mjs [extra drizzle-kit args...]
 * Example: node scripts/db-push.mjs --config=drizzle.config.js
 */
import { spawn } from 'node:child_process';

// Fake TTY so drizzle-kit doesn't crash on isTTY check
Object.defineProperty(process.stdin, 'isTTY', { value: true });
Object.defineProperty(process.stdout, 'isTTY', { value: true });

const extraArgs = process.argv.slice(2);
const child = spawn('npx', ['drizzle-kit', 'push', '--force', ...extraArgs], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env, FORCE_COLOR: '0' },
});

// Auto-answer "no" to any truncation prompts
child.stdin.on('error', () => {}); // ignore EPIPE
const interval = setInterval(() => {
  try { child.stdin.write('no\n'); } catch {}
}, 500);

child.on('close', (code) => {
  clearInterval(interval);
  if (code === 0) {
    console.log('✅ db:push succeeded');
  } else {
    console.log(`⚠️ db:push exited with code ${code} — check output above`);
  }
  process.exit(code ?? 0);
});
