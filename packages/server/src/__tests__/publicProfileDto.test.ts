/**
 * `UserProfile` is what the UNAUTHENTICATED `/api/users/:username` returns, so
 * every field on it is a field disclosed to strangers.
 *
 * That route has no `requireAuth` -- it reads the viewer opportunistically, in
 * a try/catch, only to compute a follow flag. On 2026-08-30 the DTO carried
 * `emailNotifications`, and it was live:
 *
 *   $ curl -s https://deveco.io/api/users/<member>      # no credentials
 *   {"username":"...","emailNotifications":{"likes":true,"digest":"none",...}}
 *
 * Sampled twelve profiles per instance; only two came back populated, because
 * most members never configured preferences. That is precisely why it hid --
 * a spot check of one or two profiles reads as harmless.
 *
 * The `users.email_notifications` JSONB column ALSO carries an
 * `unsubscribedAll` key (written by `unsubscribe.post.ts`, read by
 * `comms/broadcast.ts`) which appears in no TypeScript type. The old cast
 * passed the whole object through, so an unsubscribed member's suppression
 * flag was published too -- a field nobody could have found by reading the
 * interface.
 *
 * This guard is a DENYLIST checked against the runtime shape rather than a
 * snapshot of the whole DTO, so that adding an innocuous public field does not
 * fail it, while re-adding a private one does.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestDB, createTestUser } from './helpers/testdb';
import { getUserByUsername, getOwnEmailNotificationPrefs } from '../profile/profile';
import * as schema from '@commonpub/schema';
import { eq } from 'drizzle-orm';

/** Fields that must never be readable without credentials. */
const MUST_NOT_BE_PUBLIC = [
  'emailNotifications',
  'email',
  'passwordHash',
  'unsubscribedAll',
  'profileVisibility',
  'twoFactorSecret',
] as const;

describe('the public UserProfile DTO', () => {
  it('exposes none of the private fields, on a user who has them all set', async () => {
    const db = await createTestDB();
    const user = await createTestUser(db, { username: 'dtoprobe' });

    // Populate the JSONB exactly as the app does, INCLUDING the undocumented
    // key, so the assertion runs against a realistic row rather than a null.
    await db.update(schema.users)
      .set({
        emailNotifications: {
          digest: 'daily', likes: true, comments: true, follows: true, mentions: true,
          unsubscribedAll: true,
        } as never,
      })
      .where(eq(schema.users.id, user.id));

    const profile = await getUserByUsername(db, 'dtoprobe');
    expect(profile, 'fixture did not produce a profile').toBeTruthy();

    const keys = Object.keys(profile as object);
    // Positive control: a DTO that came back empty would pass every check below.
    expect(keys.length).toBeGreaterThan(8);
    expect(keys).toContain('username');

    const leaked = MUST_NOT_BE_PUBLIC.filter((k) => keys.includes(k));
    expect(leaked, `public profile DTO exposes: ${leaked.join(', ')}`).toEqual([]);

    // And not nested anywhere either.
    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain('unsubscribedAll');
    expect(serialized).not.toContain('"digest"');
  });

  it('still gives the OWNER their preferences through the owner-only reader', async () => {
    const db = await createTestDB();
    const user = await createTestUser(db, { username: 'ownerprobe' });
    await db.update(schema.users)
      .set({ emailNotifications: { digest: 'weekly', likes: true, unsubscribedAll: true } as never })
      .where(eq(schema.users.id, user.id));

    const prefs = await getOwnEmailNotificationPrefs(db, user.id);
    expect(prefs?.digest).toBe('weekly');
    expect(prefs?.likes).toBe(true);
    // The internal suppression flag is not a user-facing preference and must
    // not ride along even on the owner's own path.
    expect(JSON.stringify(prefs)).not.toContain('unsubscribedAll');
  });

  it('returns null preferences for a member who never configured any', async () => {
    const db = await createTestDB();
    const user = await createTestUser(db, { username: 'nullprobe' });
    expect(await getOwnEmailNotificationPrefs(db, user.id)).toBeNull();
  });
});

describe('the interface itself', () => {
  const src = readFileSync(resolve(__dirname, '..', 'types.ts'), 'utf8');
  const iface = /export interface UserProfile\b[\s\S]*?\n}/.exec(src)?.[0] ?? '';

  it('found the interface', () => {
    expect(iface.length).toBeGreaterThan(200);
    expect(iface).toContain('username');
  });

  it('declares no private field', () => {
    for (const k of MUST_NOT_BE_PUBLIC) {
      expect(
        new RegExp(`^\\s*${k}\\s*[?:]`, 'm').test(iface),
        `UserProfile re-declares \`${k}\`; that interface feeds the unauthenticated /api/users/:username route`,
      ).toBe(false);
    }
  });
});
