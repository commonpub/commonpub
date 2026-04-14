import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { getUserByUsername, updateUserProfile, getUserContent } from '../profile/profile.js';
import { createContent, publishContent } from '../content/content.js';

describe('profile integration', () => {
  let db: DB;
  let userId: string;
  let ghostId: string;
  const username = 'profiletest';

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username, displayName: 'Profile Tester' });
    userId = user.id;
    const ghost = await createTestUser(db, { username: 'ghostuser' });
    ghostId = ghost.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('gets user profile by username', async () => {
    const profile = await getUserByUsername(db, username);

    expect(profile).toBeDefined();
    expect(profile!.username).toBe(username);
    expect(profile!.displayName).toBe('Profile Tester');
    expect(profile!.stats).toBeDefined();
  });

  it('returns null for non-existent username', async () => {
    const profile = await getUserByUsername(db, 'nobody');
    expect(profile).toBeNull();
  });

  it('returns null for soft-deleted user', async () => {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, ghostId));
    const profile = await getUserByUsername(db, 'ghostuser');
    expect(profile).toBeNull();

    // Restore
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, ghostId));
  });

  it('returns empty content for user with no published items', async () => {
    const { items, total } = await getUserContent(db, ghostId);
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });

  it('returns correct content stats', async () => {
    // Create 2 projects and 1 article, all published
    const p1 = await createContent(db, userId, { type: 'project', title: 'Project One' });
    const p2 = await createContent(db, userId, { type: 'project', title: 'Project Two' });
    const a1 = await createContent(db, userId, { type: 'article', title: 'Article One' });

    await publishContent(db, p1.id, userId);
    await publishContent(db, p2.id, userId);
    await publishContent(db, a1.id, userId);

    const profile = await getUserByUsername(db, username);
    expect(profile).toBeDefined();
    expect(profile!.stats.projects).toBe(2);
    expect(profile!.stats.articles).toBe(1);
  });

  it('updates profile fields', async () => {
    const updated = await updateUserProfile(db, userId, {
      bio: 'Hello world',
      headline: 'Maker of things',
      location: 'Portland, OR',
      website: 'https://example.com',
    });

    expect(updated).toBeDefined();
    expect(updated!.bio).toBe('Hello world');
    expect(updated!.headline).toBe('Maker of things');
    expect(updated!.location).toBe('Portland, OR');
    expect(updated!.website).toBe('https://example.com');
  });

  it('updates social links', async () => {
    const updated = await updateUserProfile(db, userId, {
      socialLinks: {
        github: 'https://github.com/testuser',
        twitter: 'https://twitter.com/testuser',
      },
    });

    expect(updated).toBeDefined();
    expect(updated!.socialLinks).toBeDefined();
    expect(updated!.socialLinks!.github).toBe('https://github.com/testuser');
    expect(updated!.socialLinks!.twitter).toBe('https://twitter.com/testuser');
  });

  it('updates skills', async () => {
    const updated = await updateUserProfile(db, userId, {
      skills: ['TypeScript', 'Vue', 'Postgres'],
    });

    expect(updated).toBeDefined();
    expect(updated!.skills).toEqual(['TypeScript', 'Vue', 'Postgres']);
  });

  it('updates pronouns', async () => {
    const updated = await updateUserProfile(db, userId, {
      pronouns: 'they/them',
    });

    expect(updated).toBeDefined();
    expect(updated!.pronouns).toBe('they/them');
  });

  it('returns null when updating non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const result = await updateUserProfile(db, fakeId, {
      bio: 'Ghost user',
    });

    expect(result).toBeNull();
  });

  it('gets user content', async () => {
    // The 1 published article from earlier stats test should appear
    const result = await getUserContent(db, userId);

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    // All returned items should be published
    for (const item of result.items) {
      expect(item.status).toBe('published');
    }
  });

  it('getUserContent filters by type', async () => {
    const result = await getUserContent(db, userId, 'project');

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    for (const item of result.items) {
      expect(item.type).toBe('project');
    }
  });
});
