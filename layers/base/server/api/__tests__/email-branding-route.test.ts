/**
 * Static contract tests for the email-branding admin routes (email Phase 2).
 * Source-string reads (same pattern as the other admin route tests) since a full
 * nitro harness isn't wired for these handlers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '..', 'admin');
const get = readFileSync(resolve(dir, 'email-branding.get.ts'), 'utf8');
const put = readFileSync(resolve(dir, 'email-branding.put.ts'), 'utf8');
const preview = readFileSync(resolve(dir, 'email-preview.post.ts'), 'utf8');

describe('email-branding routes — contract', () => {
  it('all three are gated by the email.manage permission', () => {
    for (const [name, src] of [['get', get], ['put', put], ['preview', preview]] as const) {
      expect(src, `${name} must requirePermission email.manage`).toMatch(
        /requirePermission\(\s*event\s*,\s*['"]email\.manage['"]\s*\)/,
      );
      expect(src, `${name} must be admin-feature gated`).toMatch(/requireFeature\(\s*['"]admin['"]\s*\)/);
    }
  });

  it('write + preview validate input with emailBrandingSchema (no arbitrary HTML/CSS)', () => {
    expect(put).toMatch(/parseBody\(\s*event\s*,\s*emailBrandingSchema\s*\)/);
    expect(preview).toMatch(/parseBody\(\s*event\s*,\s*emailBrandingSchema\s*\)/);
  });

  it('write persists under the email.branding instance-settings key', () => {
    expect(put).toMatch(/setInstanceSetting\(/);
    expect(put).toMatch(/EMAIL_BRANDING_KEY/);
  });
});
