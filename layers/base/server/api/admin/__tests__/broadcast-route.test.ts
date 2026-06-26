/**
 * Static contract tests for the admin broadcast routes (email Phase 3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '..', 'broadcast');
const post = readFileSync(resolve(dir, 'index.post.ts'), 'utf8');
const get = readFileSync(resolve(dir, 'index.get.ts'), 'utf8');
const recipients = readFileSync(resolve(dir, 'recipients.post.ts'), 'utf8');

describe('admin broadcast routes — contract', () => {
  it('all routes require the broadcast.send permission', () => {
    for (const [n, s] of [['post', post], ['get', get], ['recipients', recipients]] as const) {
      expect(s, `${n} requirePermission broadcast.send`).toMatch(/requirePermission\(\s*event\s*,\s*['"]broadcast\.send['"]\s*\)/);
      expect(s, `${n} requireFeature admin`).toMatch(/requireFeature\(\s*['"]admin['"]\s*\)/);
    }
  });

  it('the SEND route is gated by the adminBroadcast feature flag', () => {
    expect(post).toMatch(/requireFeature\(\s*['"]adminBroadcast['"]\s*\)/);
  });

  it('the SEND route validates input with broadcastInputSchema and passes the auth secret', () => {
    expect(post).toMatch(/parseBody\(\s*event\s*,\s*broadcastInputSchema\s*\)/);
    expect(post).toMatch(/secret/);
    expect(post).toMatch(/sendBroadcast\(/);
  });

  it('the recipients route validates the audience with broadcastAudienceSchema', () => {
    expect(recipients).toMatch(/parseBody\(\s*event\s*,\s*broadcastAudienceSchema\s*\)/);
  });
});
