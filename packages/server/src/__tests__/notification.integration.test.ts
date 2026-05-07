import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../notification/notification.js';
import type { NotificationType } from '../notification/notification.js';

describe('notification integration', () => {
  let db: DB;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDB();
    const a = await createTestUser(db, { username: 'alice' });
    const b = await createTestUser(db, { username: 'bob' });
    alice = a.id;
    bob = b.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a notification', async () => {
    const notif = await createNotification(db, {
      userId: alice,
      type: 'like',
      title: 'New like',
      message: 'Someone liked your post',
    });

    expect(notif).toBeDefined();
    expect(notif.type).toBe('like');
    expect(notif.title).toBe('New like');
    expect(notif.message).toBe('Someone liked your post');
    expect(notif.userId).toBe(alice);
  });

  it('creates notification with actor', async () => {
    const notif = await createNotification(db, {
      userId: alice,
      type: 'follow',
      title: 'New follower',
      message: 'Bob followed you',
      actorId: bob,
    });

    expect(notif.actorId).toBe(bob);
  });

  it('lists notifications for a user', async () => {
    // Clear state by creating a fresh user
    const user = await createTestUser(db, { username: 'list-test' });

    await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Notif 3',
      message: 'Message 3',
    });

    const result = await listNotifications(db, { userId: user.id });
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('filters notifications by type', async () => {
    const user = await createTestUser(db, { username: 'type-filter' });

    await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Like notif',
      message: 'A like',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Comment notif',
      message: 'A comment',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Follow notif',
      message: 'A follow',
    });

    const result = await listNotifications(db, {
      userId: user.id,
      type: 'like' as NotificationType,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.type).toBe('like');
  });

  it('filters notifications by read status', async () => {
    const user = await createTestUser(db, { username: 'read-filter' });

    const n1 = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });

    await markNotificationRead(db, n1.id, user.id);

    const unread = await listNotifications(db, {
      userId: user.id,
      read: false,
    });
    expect(unread.items).toHaveLength(1);
    expect(unread.items[0]!.title).toBe('Notif 2');
  });

  it('gets unread count', async () => {
    const user = await createTestUser(db, { username: 'unread-count' });

    const n1 = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Notif 3',
      message: 'Message 3',
    });

    const count1 = await getUnreadCount(db, user.id);
    expect(count1).toBe(3);

    await markNotificationRead(db, n1.id, user.id);

    const count2 = await getUnreadCount(db, user.id);
    expect(count2).toBe(2);
  });

  it('marks a single notification read', async () => {
    const user = await createTestUser(db, { username: 'mark-read' });

    const notif = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'To mark read',
      message: 'Will be read',
    });

    await markNotificationRead(db, notif.id, user.id);

    const result = await listNotifications(db, {
      userId: user.id,
      read: true,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.read).toBe(true);
  });

  it('marks all notifications read', async () => {
    const user = await createTestUser(db, { username: 'mark-all-read' });

    await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'Notif 1',
      message: 'Message 1',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'comment',
      title: 'Notif 2',
      message: 'Message 2',
    });
    await createNotification(db, {
      userId: user.id,
      type: 'follow',
      title: 'Notif 3',
      message: 'Message 3',
    });

    await markAllNotificationsRead(db, user.id);

    const result = await listNotifications(db, { userId: user.id });
    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.read).toBe(true);
    }
  });

  it('deletes a notification', async () => {
    const user = await createTestUser(db, { username: 'delete-notif' });

    const notif = await createNotification(db, {
      userId: user.id,
      type: 'like',
      title: 'To delete',
      message: 'Will be deleted',
    });

    await deleteNotification(db, notif.id, user.id);

    const result = await listNotifications(db, { userId: user.id });
    expect(result.items).toHaveLength(0);
  });

  it('does not show other users notifications', async () => {
    const userA = await createTestUser(db, { username: 'isolated-a' });
    const userB = await createTestUser(db, { username: 'isolated-b' });

    await createNotification(db, {
      userId: userA.id,
      type: 'like',
      title: 'Private notif',
      message: 'Only for user A',
    });

    const result = await listNotifications(db, { userId: userB.id });
    expect(result.items).toHaveLength(0);
  });

  describe('dedup via UNIQUE (user_id, type, actor_id, link)', () => {
    it('collapses repeated social notifications to one row', async () => {
      const recipient = await createTestUser(db, { username: 'dedup-recipient' });
      const actor = await createTestUser(db, { username: 'dedup-actor' });
      const link = '/u/dedup-recipient/post/x';

      // Simulate a like → unlike → like spam loop. Each call creates the
      // notification with the same dedup key.
      const first = await createNotification(db, {
        userId: recipient.id, type: 'like', actorId: actor.id, link,
        title: 'Liked', message: 'msg-1',
      });
      const second = await createNotification(db, {
        userId: recipient.id, type: 'like', actorId: actor.id, link,
        title: 'Liked', message: 'msg-2',
      });
      const third = await createNotification(db, {
        userId: recipient.id, type: 'like', actorId: actor.id, link,
        title: 'Liked', message: 'msg-3',
      });

      // All three calls succeed and return the same DB row.
      expect(second.id).toBe(first.id);
      expect(third.id).toBe(first.id);

      // The latest message wins; read flag resets to false so the
      // consolidated notification surfaces fresh.
      const { items } = await listNotifications(db, { userId: recipient.id });
      const consolidated = items.find((n) => n.actorId === actor.id && n.link === link);
      expect(consolidated).toBeDefined();
      expect(consolidated!.message).toBe('msg-3');
      expect(consolidated!.read).toBe(false);

      // Exactly one row in the DB for this dedup tuple.
      const sameTuple = items.filter((n) =>
        n.type === 'like' && n.actorId === actor.id && n.link === link,
      );
      expect(sameTuple).toHaveLength(1);
    });

    it('marking-read then re-firing surfaces the notification fresh', async () => {
      const recipient = await createTestUser(db, { username: 'dedup-mark-read' });
      const actor = await createTestUser(db, { username: 'dedup-mark-actor' });
      const link = '/u/dedup-mark-read/post/y';

      const first = await createNotification(db, {
        userId: recipient.id, type: 'comment', actorId: actor.id, link,
        title: 'Commented', message: 'first',
      });
      await markNotificationRead(db, first.id, recipient.id);

      const second = await createNotification(db, {
        userId: recipient.id, type: 'comment', actorId: actor.id, link,
        title: 'Commented (updated)', message: 'second',
      });

      expect(second.id).toBe(first.id);
      // The dedup-update bumps read=false even though it was previously read.
      expect(second.read).toBe(false);
      // …and refreshes title and message to the latest values.
      expect(second.title).toBe('Commented (updated)');
      expect(second.message).toBe('second');
    });

    it('system notifications (no actor + no link) do not dedup', async () => {
      const recipient = await createTestUser(db, { username: 'sys-notif' });
      // Postgres NULL-distinct UNIQUE: each system notification gets its
      // own row even though (user_id, type, NULL, NULL) repeats.
      const a = await createNotification(db, {
        userId: recipient.id, type: 'system',
        title: 'Maint 1', message: 'first system msg',
      });
      const b = await createNotification(db, {
        userId: recipient.id, type: 'system',
        title: 'Maint 2', message: 'second system msg',
      });
      expect(a.id).not.toBe(b.id);

      const { items } = await listNotifications(db, { userId: recipient.id });
      const systemRows = items.filter((n) => n.type === 'system');
      expect(systemRows.length).toBeGreaterThanOrEqual(2);
    });

    it('different actors do not collide', async () => {
      const recipient = await createTestUser(db, { username: 'two-actors' });
      const actor1 = await createTestUser(db, { username: 'two-actors-a' });
      const actor2 = await createTestUser(db, { username: 'two-actors-b' });
      const link = '/u/two-actors/post/z';

      const a = await createNotification(db, {
        userId: recipient.id, type: 'like', actorId: actor1.id, link,
        title: 'Liked', message: 'from a',
      });
      const b = await createNotification(db, {
        userId: recipient.id, type: 'like', actorId: actor2.id, link,
        title: 'Liked', message: 'from b',
      });
      expect(a.id).not.toBe(b.id);
    });
  });

  /**
   * Migration-SQL data-cleanup test. The 0003 migration adds a
   * `DELETE FROM notifications a USING notifications b WHERE …` step
   * before `CREATE UNIQUE INDEX` so prod databases with pre-existing
   * duplicate rows (from like→unlike→like spam) don't fail the index
   * creation. PGlite's pushSchema-based test harness re-creates tables
   * from `social.ts` and skips .sql files entirely, so the DELETE
   * step is untested by the rest of this file.
   *
   * This describe block applies the migration's DELETE SQL directly
   * against a seeded PGlite DB and asserts the cleanup keeps the
   * newest row per dedup tuple.
   */
  describe('migration 0003 DELETE statement', () => {
    it('keeps newest row per (user_id, type, actor_id, link) tuple, then index recreates cleanly', async () => {
      // pushSchema already created `uq_notif_user_type_actor_link` for us.
      // To simulate a pre-migration prod database (which had no such index
      // and had accumulated duplicates), DROP the index first, seed dupes,
      // run the migration's DELETE, then re-create the index — the
      // re-creation succeeding is the load-bearing assertion that the
      // DELETE actually produced clean data.
      const fs = await import('node:fs');
      const path = await import('node:path');

      // Use a fresh test DB so we don't pollute earlier tests' state.
      const migDb = await createTestDB();
      try {
        await migDb.execute(sql`DROP INDEX IF EXISTS uq_notif_user_type_actor_link`);

        const recipient = await createTestUser(migDb, { username: 'mig-recipient' });
        const actor = await createTestUser(migDb, { username: 'mig-actor' });
        const otherActor = await createTestUser(migDb, { username: 'mig-other' });
        const link = '/u/mig-recipient/post/dup';

        const oldDate = new Date('2026-01-01T00:00:00Z');
        const midDate = new Date('2026-02-01T00:00:00Z');
        const newDate = new Date('2026-03-01T00:00:00Z');

        // Plant 3 duplicates of the same dedup tuple (different timestamps).
        await migDb.execute(sql`
          INSERT INTO notifications (user_id, type, title, message, link, actor_id, created_at)
          VALUES
            (${recipient.id}, 'like', 'Old Like', 'oldest', ${link}, ${actor.id}, ${oldDate}),
            (${recipient.id}, 'like', 'Mid Like', 'middle', ${link}, ${actor.id}, ${midDate}),
            (${recipient.id}, 'like', 'New Like', 'newest', ${link}, ${actor.id}, ${newDate})
        `);
        // Different actor on same link → MUST NOT be deleted.
        await migDb.execute(sql`
          INSERT INTO notifications (user_id, type, title, message, link, actor_id, created_at)
          VALUES (${recipient.id}, 'like', 'Other Like', 'other', ${link}, ${otherActor.id}, ${midDate})
        `);
        // System notifs (NULL actor + NULL link) → MUST stay independent.
        await migDb.execute(sql`
          INSERT INTO notifications (user_id, type, title, message, link, actor_id, created_at)
          VALUES
            (${recipient.id}, 'system', 'Sys 1', 'sys 1', NULL, NULL, ${oldDate}),
            (${recipient.id}, 'system', 'Sys 2', 'sys 2', NULL, NULL, ${midDate})
        `);

        // Apply the migration SQL verbatim from the .sql file. Read the
        // file so a future edit that breaks the cleanup intent surfaces here.
        const migrationPath = path.resolve(
          __dirname,
          '../../../schema/migrations/0003_notifications_dedup.sql',
        );
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        const statements = migrationSql
          .split('--> statement-breakpoint')
          .map((s) => s
            .split('\n')
            .filter((line) => !line.trim().startsWith('--'))
            .join('\n')
            .trim())
          .filter((s) => s.length > 0);
        for (const stmt of statements) {
          await migDb.execute(sql.raw(stmt));
        }

        // The migration's CREATE UNIQUE INDEX succeeding (no error thrown)
        // is itself the proof that the DELETE produced clean data — if the
        // tie-break were wrong or any duplicate survived, this would have
        // failed with `could not create unique index`.

        // Belt-and-suspenders content assertions:
        const rows = await migDb.execute(sql`
          SELECT title, message, actor_id, link
          FROM notifications
          WHERE user_id = ${recipient.id}
          ORDER BY created_at DESC
        `);
        const r = (rows.rows ?? []) as Array<{
          title: string; message: string; actor_id: string | null; link: string | null;
        }>;

        const dupSurvivors = r.filter((row) =>
          row.actor_id === actor.id && row.link === link,
        );
        expect(dupSurvivors).toHaveLength(1);
        expect(dupSurvivors[0]!.message).toBe('newest');

        const otherSurvivors = r.filter((row) =>
          row.actor_id === otherActor.id && row.link === link,
        );
        expect(otherSurvivors).toHaveLength(1);

        const systemSurvivors = r.filter((row) =>
          row.actor_id === null && row.link === null,
        );
        expect(systemSurvivors).toHaveLength(2);
      } finally {
        await closeTestDB(migDb);
      }
    });
  });
});
