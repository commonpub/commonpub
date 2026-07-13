/**
 * Static contract tests for the per-contest email-preview route (session 232).
 * Source-string reads (same pattern as email-branding-route.test.ts) since a full
 * nitro harness isn't wired for these handlers. These lock in the load-bearing
 * gates: feature flags, an organizer-only authorization check, and schema-validated
 * input (so the preview can never render arbitrary organizer HTML).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const preview = readFileSync(resolve(__dirname, '..', 'contests', '[slug]', 'email-preview.post.ts'), 'utf8');
const put = readFileSync(resolve(__dirname, '..', 'contests', '[slug]', 'index.put.ts'), 'utf8');

describe('contest email-preview route — contract', () => {
  it('is gated by the contests AND contestEmailEditor feature flags', () => {
    expect(preview).toMatch(/requireFeature\(\s*['"]contests['"]\s*\)/);
    expect(preview).toMatch(/requireFeature\(\s*['"]contestEmailEditor['"]\s*\)/);
  });

  it('requires auth and an organizer-only authorization check (owner / manage / editor)', () => {
    expect(preview).toMatch(/requireAuth\(\s*event\s*\)/);
    expect(preview).toMatch(/ownerOrPermission\(/);
    expect(preview).toMatch(/isContestEditor\(/);
    // A non-editor is rejected with 403.
    expect(preview).toMatch(/statusCode:\s*403/);
  });

  it('validates the POSTed copy with contestEmailPreviewSchema (no arbitrary HTML)', () => {
    expect(preview).toMatch(/parseBody\(\s*event\s*,\s*contestEmailPreviewSchema\s*\)/);
  });

  it('renders through the real contest email templates (server-owned escaping)', () => {
    expect(preview).toMatch(/emailTemplates\.contestRegistrationConfirmation/);
    expect(preview).toMatch(/emailTemplates\.contestDeadlineReminder/);
  });

  it('the contest PUT route carries emailCopy via updateContestSchema (no separate save endpoint)', () => {
    // emailCopy rides the standard whole-contest update payload.
    expect(put).toMatch(/parseBody\(\s*event\s*,\s*updateContestSchema\s*\)/);
  });
});
