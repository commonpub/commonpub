/**
 * WIRING guards for the P0 private-file routes (contestPrivateFiles).
 *
 * The behavioural logic lives in unit-tested infra (LocalStorage/S3 private
 * methods, packages/infra/src/__tests__/storage.test.ts). These are source reads
 * — no PGlite+nitro+better-auth harness is wired for these layer handlers — that
 * lock in the security-critical WIRING: the auth/permission/feature gates, the
 * 404-not-403 non-disclosure, and the image-processing SKIP that keeps a private
 * upload off the public adapter. A regression here would silently leak
 * confidential contest files, so guard it at the string level at minimum.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raw = readFileSync(resolve(__dirname, '..', '[id]', 'raw.get.ts'), 'utf8');
const upload = readFileSync(resolve(__dirname, '..', 'upload.post.ts'), 'utf8');

describe('GET /api/files/:id/raw — private serving route wiring', () => {
  it('is gated behind the contestPrivateFiles feature flag', () => {
    expect(raw).toMatch(/requireFeature\(\s*['"]contestPrivateFiles['"]\s*\)/);
  });

  it('requires auth and validates the id as a uuid before the query', () => {
    expect(raw).toMatch(/requireAuth\(event\)/);
    expect(raw).toMatch(/parseParams\(event,\s*\{\s*id:\s*['"]uuid['"]\s*\}\)/);
  });

  it('serves private files only and authorizes on owner OR contest.pii', () => {
    expect(raw, "must restrict to visibility === 'private'").toMatch(/visibility\s*===\s*['"]private['"]/);
    expect(raw).toMatch(/row\.uploaderId\s*===\s*user\.id/);
    expect(raw).toMatch(/hasPermission\(event,\s*['"]contest\.pii['"]\)/);
  });

  it('404s (not 403) on unknown/public/unauthorized — no existence oracle', () => {
    expect(raw).toMatch(/statusCode:\s*404/);
    expect(raw, 'must NOT 403 (that would confirm a private file exists)').not.toMatch(/statusCode:\s*403/);
  });

  it('streams with private, no-store caching via the shared safe-header helper', () => {
    expect(raw).toMatch(/setStoredFileHeaders\(/);
    expect(raw).toMatch(/no-store/);
    expect(raw).toMatch(/getPrivateObject\(/);
  });
});

describe('POST /api/files/upload — private (contest) purpose wiring', () => {
  it('accepts the contest purpose and treats it as private', () => {
    expect(upload).toMatch(/'contest'/);
    expect(upload).toMatch(/isPrivate\s*=\s*purpose\s*===\s*['"]contest['"]/);
  });

  it('gates the private path behind contestPrivateFiles', () => {
    expect(upload).toMatch(/if\s*\(isPrivate\)\s*requireFeature\(\s*['"]contestPrivateFiles['"]\s*\)/);
  });

  it('routes private uploads to uploadPrivate and NEVER through public image processing', () => {
    // The private branch is checked FIRST (mutually exclusive with isProcessableImage),
    // and calls uploadPrivate — processImage writes PUBLIC variants, which would leak.
    expect(upload).toMatch(/if\s*\(isPrivate\)\s*\{[\s\S]*?uploadPrivate\(/);
    expect(upload).toMatch(/\}\s*else\s+if\s*\(isProcessableImage/);
  });

  it('persists visibility=private with a null public URL and returns the gated route', () => {
    expect(upload).toMatch(/visibility:\s*isPrivate\s*\?\s*['"]private['"]\s*:\s*['"]public['"]/);
    expect(upload).toMatch(/publicUrl,\s*\/\/ null for private uploads/);
    expect(upload).toMatch(/\/api\/files\/\$\{row!\.id\}\/raw/);
  });
});
