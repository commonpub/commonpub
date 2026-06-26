import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, emailOutbox, broadcasts } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { sendBroadcast, countBroadcastRecipients, listBroadcasts } from '../comms/broadcast.js';
import { verifyUnsubscribeToken } from '../comms/unsubscribe.js';

// Email Phase 3: admin broadcast — audience targeting + verified/unsubscribe
// filters + outbox enqueue + audit row.

const SECRET = 'broadcast-secret';

async function mkUser(db: DB, over: { username: string; verified?: boolean; role?: string; unsub?: boolean }) {
  const u = await createTestUser(db, { username: over.username });
  await db.update(users).set({
    emailVerified: over.verified ?? true,
    role: (over.role ?? 'member') as 'member',
    emailNotifications: over.unsub ? { unsubscribedAll: true } : {},
  }).where(eq(users.id, u.id));
  return u;
}

function send(db: DB, audience: 'all' | { role: string } | { userIds: string[] }, sentBy: string) {
  return sendBroadcast(db, {
    subject: 'Big news', bodyText: 'Hello everyone.\n\nThanks.', audience,
    sentBy, siteName: 'Test', siteUrl: 'https://test.example', secret: SECRET,
  });
}

describe('sendBroadcast', () => {
  let db: DB;
  let admin: string, verified: string, staff: string, unsubbed: string, unverified: string;

  beforeAll(async () => {
    db = await createTestDB();
    const ts = Date.now();
    admin = (await mkUser(db, { username: `bc-admin-${ts}`, role: 'admin' })).id;
    verified = (await mkUser(db, { username: `bc-ver-${ts}` })).id;
    staff = (await mkUser(db, { username: `bc-staff-${ts}`, role: 'staff' })).id;
    unsubbed = (await mkUser(db, { username: `bc-unsub-${ts}`, unsub: true })).id;
    unverified = (await mkUser(db, { username: `bc-unver-${ts}`, verified: false })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  it("'all' targets verified, not-unsubscribed users only", async () => {
    const r = await send(db, 'all', admin);
    const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.category, 'broadcast'));
    const recipientIds = new Set(rows.map((x) => x.userId));
    // includes admin/verified/staff; excludes the unsubscribed + unverified.
    expect(recipientIds.has(admin)).toBe(true);
    expect(recipientIds.has(verified)).toBe(true);
    expect(recipientIds.has(staff)).toBe(true);
    expect(recipientIds.has(unsubbed)).toBe(false);
    expect(recipientIds.has(unverified)).toBe(false);
    expect(r.recipientCount).toBe(recipientIds.size);

    // each carries a valid per-recipient unsubscribe header
    const anyRow = rows[0]!;
    const hdr = (anyRow.headers as Record<string, string>)['List-Unsubscribe']!;
    const token = hdr.match(/token=([^>]+)/)?.[1] ?? '';
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(anyRow.userId);

    // an audit row was recorded
    const [b] = await listBroadcasts(db, 5);
    expect(b!.recipientCount).toBe(r.recipientCount);
    const [stored] = await db.select().from(broadcasts).where(eq(broadcasts.id, (await db.select().from(broadcasts).limit(1))[0]!.id));
    expect(stored!.subject).toBe('Big news');
  });

  it("'role' targets only that role", async () => {
    const fresh = await createTestDB();
    try {
      const ts = Date.now();
      const a = (await mkUser(fresh, { username: `r-a-${ts}`, role: 'admin' })).id;
      const s = (await mkUser(fresh, { username: `r-s-${ts}`, role: 'staff' })).id;
      await mkUser(fresh, { username: `r-m-${ts}`, role: 'member' });
      const r = await send(fresh, { role: 'staff' }, a);
      const rows = await fresh.select().from(emailOutbox);
      expect(rows.map((x) => x.userId)).toEqual([s]);
      expect(r.recipientCount).toBe(1);
    } finally { await closeTestDB(fresh); }
  });

  it("'userIds' targets exactly the given (verified) users", async () => {
    const fresh = await createTestDB();
    try {
      const ts = Date.now();
      const a = (await mkUser(fresh, { username: `u-a-${ts}`, role: 'admin' })).id;
      const b = (await mkUser(fresh, { username: `u-b-${ts}` })).id;
      const c = (await mkUser(fresh, { username: `u-c-${ts}` })).id;
      const r = await send(fresh, { userIds: [b, c] }, a);
      const rows = await fresh.select().from(emailOutbox);
      expect(new Set(rows.map((x) => x.userId))).toEqual(new Set([b, c]));
      expect(r.recipientCount).toBe(2);
    } finally { await closeTestDB(fresh); }
  });

  it('countBroadcastRecipients matches the send count', async () => {
    const fresh = await createTestDB();
    try {
      const ts = Date.now();
      const a = (await mkUser(fresh, { username: `c-a-${ts}`, role: 'admin' })).id;
      await mkUser(fresh, { username: `c-b-${ts}` });
      await mkUser(fresh, { username: `c-unsub-${ts}`, unsub: true });
      const count = await countBroadcastRecipients(fresh, 'all');
      const r = await send(fresh, 'all', a);
      expect(count).toBe(r.recipientCount);
      expect(count).toBe(2); // admin + b, not the unsubscribed
    } finally { await closeTestDB(fresh); }
  });
});
