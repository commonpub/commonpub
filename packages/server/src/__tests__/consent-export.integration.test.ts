import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  users,
  userConsents,
  hubs,
  hubPosts,
  hubPostReplies,
  videos,
  learningPaths,
  certificates,
  products,
  docsSites,
  reports,
  hubFlags,
  files,
  contentItems,
  contentVersions,
  referralLinks,
  referralAttributions,
  sessions,
} from '@commonpub/schema';
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

describe('exportUserData round-6 completeness (session 231)', () => {
  let db: DB;
  let subjectId: string;
  let thirdPartyId: string;
  const secretToken = 'SECRET-SESSION-TOKEN-should-never-export';

  beforeAll(async () => {
    db = await createTestDB();
    subjectId = (await createTestUser(db, { username: `subj-${Date.now()}` })).id;
    thirdPartyId = (await createTestUser(db, { username: `tp-${Date.now()}` })).id;

    // A hub to host forum/product rows (created by a third party — the subject only authors within it).
    const [hub] = await db.insert(hubs).values({
      name: 'Test Hub', slug: `hub-${Date.now()}`, createdById: thirdPartyId,
    }).returning();
    const hubId = hub!.id;

    // Hub posts + replies (subject vs third party)
    const [subjPost] = await db.insert(hubPosts).values({ hubId, authorId: subjectId, content: 'subject-hub-post' }).returning();
    await db.insert(hubPosts).values({ hubId, authorId: thirdPartyId, content: 'THIRDPARTY-hub-post' });
    await db.insert(hubPostReplies).values({ postId: subjPost!.id, authorId: subjectId, content: 'subject-reply' });
    await db.insert(hubPostReplies).values({ postId: subjPost!.id, authorId: thirdPartyId, content: 'THIRDPARTY-reply' });

    // Videos
    await db.insert(videos).values({ authorId: subjectId, title: 'subject-video', url: 'https://x/1', platform: 'youtube' });
    await db.insert(videos).values({ authorId: thirdPartyId, title: 'THIRDPARTY-video', url: 'https://x/2', platform: 'youtube' });

    // Learning paths (authored) + certificate
    const [subjPath] = await db.insert(learningPaths).values({ title: 'subject-path', slug: `sp-${Date.now()}`, authorId: subjectId }).returning();
    await db.insert(learningPaths).values({ title: 'THIRDPARTY-path', slug: `tp-${Date.now()}`, authorId: thirdPartyId });
    await db.insert(certificates).values({ userId: subjectId, pathId: subjPath!.id, verificationCode: `SUBJ-CERT-${Date.now()}` });
    await db.insert(certificates).values({ userId: thirdPartyId, pathId: subjPath!.id, verificationCode: `TP-CERT-${Date.now()}` });

    // Products
    await db.insert(products).values({ name: 'subject-product', slug: `sprod-${Date.now()}`, hubId, createdById: subjectId });
    await db.insert(products).values({ name: 'THIRDPARTY-product', slug: `tprod-${Date.now()}`, hubId, createdById: thirdPartyId });

    // Docs sites
    await db.insert(docsSites).values({ name: 'subject-docs', slug: `sdocs-${Date.now()}`, ownerId: subjectId });
    await db.insert(docsSites).values({ name: 'THIRDPARTY-docs', slug: `tpdocs-${Date.now()}`, ownerId: thirdPartyId });

    // Reports (subject's own statement; third party's report must not leak)
    await db.insert(reports).values({ reporterId: subjectId, targetType: 'user', targetId: thirdPartyId, reason: 'spam', description: 'subject-report-statement' });
    await db.insert(reports).values({ reporterId: thirdPartyId, targetType: 'user', targetId: subjectId, reason: 'harassment', description: 'THIRDPARTY-report-statement' });

    // Hub moderation flags the subject raised (own statement; third party's must not leak)
    await db.insert(hubFlags).values({ hubId, targetType: 'member', targetId: thirdPartyId, flaggedById: subjectId, reason: 'subject-hubflag-statement' });
    await db.insert(hubFlags).values({ hubId, targetType: 'member', targetId: subjectId, flaggedById: thirdPartyId, reason: 'THIRDPARTY-hubflag' });

    // Files
    await db.insert(files).values({ uploaderId: subjectId, filename: 'subject-file.png', mimeType: 'image/png', sizeBytes: 10, storageKey: 'k1' });
    await db.insert(files).values({ uploaderId: thirdPartyId, filename: 'THIRDPARTY-file.png', mimeType: 'image/png', sizeBytes: 10, storageKey: 'k2' });

    // Content + content versions (authored)
    const [subjContent] = await db.insert(contentItems).values({ authorId: subjectId, type: 'blog', title: 'subject-content', slug: `sc-${Date.now()}` }).returning();
    await db.insert(contentVersions).values({ contentId: subjContent!.id, version: 1, title: 'subject-version', createdById: subjectId });
    await db.insert(contentVersions).values({ contentId: subjContent!.id, version: 2, title: 'THIRDPARTY-version', createdById: thirdPartyId });

    // Referral: subject owns REF-SUB (referred the third party); third party owns REF-TP (referred the subject).
    const [subjLink] = await db.insert(referralLinks).values({ ownerId: subjectId, code: 'REF-SUB' }).returning();
    const [tpLink] = await db.insert(referralLinks).values({ ownerId: thirdPartyId, code: 'REF-TP' }).returning();
    // Subject was referred via the third party's link (subject's OWN attribution).
    await db.insert(referralAttributions).values({ referralLinkId: tpLink!.id, ownerId: thirdPartyId, referredUserId: subjectId });
    // Subject referred the third party via their own link (owner-side — must NOT export third-party id).
    await db.insert(referralAttributions).values({ referralLinkId: subjLink!.id, ownerId: subjectId, referredUserId: thirdPartyId });

    // A secret session — must never appear anywhere in the export.
    await db.insert(sessions).values({ userId: subjectId, token: secretToken, expiresAt: new Date(Date.now() + 1e6) });
  });

  afterAll(async () => { await closeTestDB(db); });

  it('includes the subject\'s own rows across all newly-added HIGH sections', async () => {
    const data = await exportUserData(db, subjectId);

    for (const key of [
      'referralLinks', 'referralAttributions', 'hubPosts', 'hubPostReplies', 'videos',
      'learningPathsAuthored', 'products', 'docsSites', 'reports', 'hubFlags', 'certificates',
      'files', 'contentVersions',
    ] as const) {
      expect(Array.isArray(data[key]), `${key} should be an array`).toBe(true);
    }

    const blob = JSON.stringify(data);
    // Subject rows present
    expect(blob).toContain('subject-hub-post');
    expect(blob).toContain('subject-reply');
    expect(blob).toContain('subject-video');
    expect(blob).toContain('subject-path');
    expect(blob).toContain('subject-product');
    expect(blob).toContain('subject-docs');
    expect(blob).toContain('subject-report-statement');
    expect(blob).toContain('subject-hubflag-statement');
    expect(blob).toContain('subject-version');
    expect(blob).toContain('subject-file.png');

    expect(data.hubPosts).toHaveLength(1);
    expect(data.videos).toHaveLength(1);
    expect(data.learningPathsAuthored).toHaveLength(1);
    expect(data.products).toHaveLength(1);
    expect(data.docsSites).toHaveLength(1);
    expect(data.reports).toHaveLength(1);
    expect(data.hubFlags).toHaveLength(1);
    expect(data.files).toHaveLength(1);
    expect(data.contentVersions).toHaveLength(1);
    expect(data.certificates).toHaveLength(1);
  });

  it('does NOT leak any third-party rows or secrets', async () => {
    const data = await exportUserData(db, subjectId);
    const blob = JSON.stringify(data);

    // No third-party authored content
    expect(blob).not.toContain('THIRDPARTY');
    // No secret session token / no auth-secret sections
    expect(blob).not.toContain(secretToken);
    for (const forbidden of ['sessions', 'accounts', 'keypairs', 'auditLogs', 'actorKeypairs']) {
      expect(Object.keys(data)).not.toContain(forbidden);
    }
  });

  it('exports the subject\'s OWN referral attribution (via third-party link) but not owner-side third-party ids', async () => {
    const data = await exportUserData(db, subjectId);

    // Own link the subject created
    expect(data.referralLinks).toHaveLength(1);
    expect((data.referralLinks[0] as { code: string }).code).toBe('REF-SUB');

    // Own attribution = the subject was referred via the third party's REF-TP link.
    expect(data.referralAttributions).toHaveLength(1);
    const attr = data.referralAttributions[0] as Record<string, unknown>;
    expect(attr.referringLinkCode).toBe('REF-TP');
    // The third party's user id must not be enumerated anywhere in the attribution rows.
    expect(JSON.stringify(data.referralAttributions)).not.toContain(thirdPartyId);
  });

  it('includes G1 audit columns on consents (ip / user-agent) and the profile terms fields', async () => {
    await db.insert(userConsents).values({
      userId: subjectId, kind: 'terms', version: '1', ipAddress: '198.51.100.7', userAgent: 'TestAgent/1.0',
    });
    await db.update(users)
      .set({ acceptedTermsAt: new Date(), acceptedTermsVersion: '1' })
      .where(eq(users.id, subjectId));

    const data = await exportUserData(db, subjectId);
    const consent = data.consents.find((c) => (c as { kind: string }).kind === 'terms') as Record<string, unknown>;
    expect(consent.ipAddress).toBe('198.51.100.7');
    expect(consent.userAgent).toBe('TestAgent/1.0');
    expect(data.profile.acceptedTermsVersion).toBe('1');
    expect(data.profile.acceptedTermsAt).toBeTruthy();
  });
});
