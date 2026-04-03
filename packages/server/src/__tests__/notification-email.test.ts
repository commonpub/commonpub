import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  shouldEmailNotification,
  getNotificationEmailTarget,
  setNotificationEmailSender,
  createNotification,
} from '../notification/notification.js';

describe('shouldEmailNotification', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'emailpref' });
    userId = user.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  async function setPrefs(prefs: Record<string, unknown> | null): Promise<void> {
    await db.update(users).set({ emailNotifications: prefs as never }).where(eq(users.id, userId));
  }

  it('returns false when user has no preferences', async () => {
    await setPrefs(null);
    expect(await shouldEmailNotification(db, userId, 'like')).toBe(false);
  });

  it('returns false when user has empty preferences', async () => {
    await setPrefs({});
    expect(await shouldEmailNotification(db, userId, 'like')).toBe(false);
  });

  it('returns true when user enabled likes', async () => {
    await setPrefs({ likes: true });
    expect(await shouldEmailNotification(db, userId, 'like')).toBe(true);
  });

  it('returns false when user disabled likes', async () => {
    await setPrefs({ likes: false });
    expect(await shouldEmailNotification(db, userId, 'like')).toBe(false);
  });

  it('returns true for each enabled type', async () => {
    await setPrefs({ comments: true, follows: true, mentions: true });
    expect(await shouldEmailNotification(db, userId, 'comment')).toBe(true);
    expect(await shouldEmailNotification(db, userId, 'follow')).toBe(true);
    expect(await shouldEmailNotification(db, userId, 'mention')).toBe(true);
  });

  it('returns false for types without a toggle (system, hub, contest, etc.)', async () => {
    await setPrefs({ likes: true, comments: true, follows: true, mentions: true });
    expect(await shouldEmailNotification(db, userId, 'system')).toBe(false);
    expect(await shouldEmailNotification(db, userId, 'hub')).toBe(false);
    expect(await shouldEmailNotification(db, userId, 'contest')).toBe(false);
    expect(await shouldEmailNotification(db, userId, 'certificate')).toBe(false);
    expect(await shouldEmailNotification(db, userId, 'fork')).toBe(false);
    expect(await shouldEmailNotification(db, userId, 'build')).toBe(false);
  });

  it('returns false when digest is daily (instant suppressed)', async () => {
    await setPrefs({ digest: 'daily', likes: true });
    expect(await shouldEmailNotification(db, userId, 'like')).toBe(false);
  });

  it('returns false when digest is weekly (instant suppressed)', async () => {
    await setPrefs({ digest: 'weekly', comments: true });
    expect(await shouldEmailNotification(db, userId, 'comment')).toBe(false);
  });

  it('returns true when digest is none and type enabled', async () => {
    await setPrefs({ digest: 'none', likes: true });
    expect(await shouldEmailNotification(db, userId, 'like')).toBe(true);
  });

  it('returns false for nonexistent user', async () => {
    expect(await shouldEmailNotification(db, '00000000-0000-0000-0000-000000000000', 'like')).toBe(false);
  });
});

describe('getNotificationEmailTarget', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('returns email and username for verified user', async () => {
    const user = await createTestUser(db, { username: 'verified-email' });
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
    const target = await getNotificationEmailTarget(db, user.id);
    expect(target).not.toBeNull();
    expect(target!.username).toBe('verified-email');
    expect(target!.email).toContain('@');
  });

  it('returns null for unverified user', async () => {
    const user = await createTestUser(db, { username: 'unverified-email' });
    // Default emailVerified is false
    const target = await getNotificationEmailTarget(db, user.id);
    expect(target).toBeNull();
  });

  it('returns null for nonexistent user', async () => {
    const target = await getNotificationEmailTarget(db, '00000000-0000-0000-0000-000000000000');
    expect(target).toBeNull();
  });
});

describe('createNotification email sender integration', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'email-sender-test' });
    userId = user.id;
  });

  afterAll(async () => {
    // Reset the sender to avoid affecting other tests
    setNotificationEmailSender(null as never);
    await closeTestDB(db);
  });

  it('calls the registered email sender on notification creation', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    setNotificationEmailSender(sender);

    await createNotification(db, {
      userId,
      type: 'like',
      title: 'Test',
      message: 'Test email integration',
    });

    // Fire-and-forget, wait a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith(db, expect.objectContaining({
      userId,
      type: 'like',
      title: 'Test',
    }));
  });

  it('does not throw if email sender fails', async () => {
    const sender = vi.fn().mockRejectedValue(new Error('SMTP down'));
    setNotificationEmailSender(sender);

    // Should not throw
    const notif = await createNotification(db, {
      userId,
      type: 'comment',
      title: 'Resilience test',
      message: 'Email failure should not block',
    });
    expect(notif.id).toBeDefined();

    await new Promise((r) => setTimeout(r, 50));
    expect(sender).toHaveBeenCalled();
  });
});
