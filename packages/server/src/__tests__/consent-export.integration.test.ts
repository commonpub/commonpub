import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, userConsents } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { recordConsent, needsTermsReacceptance } from '../profile/consent.js';
import { exportUserData } from '../profile/export.js';

// GDPR Phase 1 (session 227): terms-acceptance recording + export completeness.

describe('needsTermsReacceptance (GDPR Phase 2)', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: `reaccept-${Date.now()}` })).id;
    await recordConsent(db, { userId, kind: 'terms', version: '1' }); // accepted v1
  });
  afterAll(async () => { await closeTestDB(db); });

  it('is false when the feature is disabled (regardless of version)', async () => {
    expect(await needsTermsReacceptance(db, userId, { enabled: false, termsVersion: '2' })).toBe(false);
  });

  it('is false when enabled and the accepted version matches', async () => {
    expect(await needsTermsReacceptance(db, userId, { enabled: true, termsVersion: '1' })).toBe(false);
  });

  it('is true when enabled and the accepted version is behind', async () => {
    expect(await needsTermsReacceptance(db, userId, { enabled: true, termsVersion: '2' })).toBe(true);
  });

  it('is true when enabled and the user never accepted', async () => {
    const fresh = (await createTestUser(db, { username: `reaccept-never-${Date.now()}` })).id;
    expect(await needsTermsReacceptance(db, fresh, { enabled: true, termsVersion: '1' })).toBe(true);
  });
});

describe('recordConsent', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: `consent-${Date.now()}` })).id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('records a terms acceptance row AND sets the denormalized users columns', async () => {
    await recordConsent(db, { userId, kind: 'terms', version: '2', ip: '203.0.113.9' });

    const rows = await db.select().from(userConsents).where(eq(userConsents.userId, userId));
    const terms = rows.find((r) => r.kind === 'terms');
    expect(terms).toBeDefined();
    expect(terms!.version).toBe('2');
    expect(terms!.ipAddress).toBe('203.0.113.9');

    const [u] = await db
      .select({ at: users.acceptedTermsAt, v: users.acceptedTermsVersion })
      .from(users)
      .where(eq(users.id, userId));
    expect(u!.at).toBeInstanceOf(Date);
    expect(u!.v).toBe('2');
  });

  it('records a non-terms consent (e.g. cookies) WITHOUT touching the terms columns', async () => {
    const other = (await createTestUser(db, { username: `consent-cookie-${Date.now()}` })).id;
    await recordConsent(db, { userId: other, kind: 'cookies', version: '1' });

    const rows = await db.select().from(userConsents).where(eq(userConsents.userId, other));
    expect(rows.map((r) => r.kind)).toEqual(['cookies']);

    const [u] = await db
      .select({ at: users.acceptedTermsAt, v: users.acceptedTermsVersion })
      .from(users)
      .where(eq(users.id, other));
    expect(u!.at).toBeNull();
    expect(u!.v).toBeNull();
  });

  it('dedups: re-recording the SAME version is a no-op; a NEW version records', async () => {
    const u = (await createTestUser(db, { username: `consent-dedup-${Date.now()}` })).id;
    await recordConsent(db, { userId: u, kind: 'cookies', version: '1' });
    await recordConsent(db, { userId: u, kind: 'cookies', version: '1' }); // dup → skipped
    await recordConsent(db, { userId: u, kind: 'cookies', version: '1' }); // dup → skipped
    expect((await db.select().from(userConsents).where(eq(userConsents.userId, u))).length).toBe(1);

    await recordConsent(db, { userId: u, kind: 'cookies', version: '2' }); // new version → recorded
    expect((await db.select().from(userConsents).where(eq(userConsents.userId, u))).length).toBe(2);
  });
});

describe('exportUserData GDPR completeness', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    userId = (await createTestUser(db, { username: `export-${Date.now()}` })).id;
    await recordConsent(db, { userId, kind: 'terms', version: '1' });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('includes the new GDPR-completeness sections, with the consent recorded', async () => {
    const data = await exportUserData(db, userId);

    // The previously-omitted sections now exist as arrays.
    for (const key of [
      'consents', 'votes', 'hubMemberships', 'enrollments', 'events',
      'eventRsvps', 'contestEntries', 'contestPersonalData', 'contestAgreements',
    ] as const) {
      expect(Array.isArray(data[key]), `${key} should be an array`).toBe(true);
    }

    // The terms acceptance shows up in the export.
    expect(data.consents).toHaveLength(1);
    expect((data.consents[0] as { kind: string }).kind).toBe('terms');
  });
});
