/**
 * Non-interactive drizzle-kit push wrapper for CI environments.
 *
 * drizzle-kit push --force skips "apply changes?" prompts but NOT
 * "do you want to truncate?" suggestion prompts. Those check isTTY
 * and crash in CI. This wrapper uses the `script` command to create
 * a real pseudo-TTY, then pipes "no" to all truncation prompts.
 *
 * Usage: node scripts/db-push.mjs [extra drizzle-kit args...]
 */
import { spawn } from 'node:child_process';

const extraArgs = process.argv.slice(2);
const dkCmd = `npx drizzle-kit push --force ${extraArgs.join(' ')}`.trim();

// Use `script` to create a pseudo-TTY (Alpine Linux compatible)
// -q = quiet, -e = return exit code, -f = flush, -c = command
const child = spawn('script', ['-qefc', dkCmd, '/dev/null'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env, FORCE_COLOR: '0', TERM: 'dumb' },
});

// Auto-answer "no" to truncation prompts — safe because:
// - Constraints will be added via ALTER TABLE (not truncate + re-add)
// - If the constraint already exists, the ALTER TABLE fails harmlessly
child.stdin.on('error', () => {}); // ignore EPIPE if process exits early
const interval = setInterval(() => {
  try { child.stdin.write('no\n'); } catch {}
}, 300);

child.on('close', (code) => {
  clearInterval(interval);
  if (code === 0) {
    console.log('✅ db:push succeeded');
  } else {
    console.log(`⚠️ db:push exited with code ${code}`);
  }
  process.exit(code ?? 0);
});
