import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { users, broadcasts } from '@commonpub/schema';
import type { BroadcastInput, BroadcastAudience } from '@commonpub/schema';
import type { DB } from '../types.js';
import { emailTemplates } from '../email.js';
import { enqueueEmails } from './outbox.js';
import type { OutboxMessage } from './outbox.js';
import { buildUnsubscribeLinks } from './unsubscribe.js';
import { getEmailBranding } from './branding.js';

// Admin broadcast (email Phase 3). Sends an operator-composed message to a target
// audience via the durable outbox. Recipients are always email-verified and NOT
// globally unsubscribed; the body is plain text + an optional CTA (validated
// upstream). Each email carries a per-recipient one-click unsubscribe.

export interface SendBroadcastInput extends BroadcastInput {
  /** The admin user id (audit). */
  sentBy: string;
  siteName: string;
  siteUrl: string;
  /** AUTH_SECRET — signs the per-recipient unsubscribe tokens. */
  secret: string;
}

// Verified + not-globally-unsubscribed. `->> 'unsubscribedAll' IS DISTINCT FROM
// 'true'` includes users with no prefs row (null) and those who haven't opted out.
function audienceWhere(audience: BroadcastAudience) {
  const conds = [
    eq(users.emailVerified, true),
    sql`(${users.emailNotifications} ->> 'unsubscribedAll') IS DISTINCT FROM 'true'`,
  ];
  if (audience !== 'all') {
    if ('role' in audience) conds.push(eq(users.role, audience.role));
    else conds.push(inArray(users.id, audience.userIds));
  }
  return and(...conds);
}

/** Estimated recipient count for an audience (verified, not unsubscribed). */
export async function countBroadcastRecipients(db: DB, audience: BroadcastAudience): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(audienceWhere(audience));
  return row?.count ?? 0;
}

const ENQUEUE_CHUNK = 500;

export async function sendBroadcast(
  db: DB,
  input: SendBroadcastInput,
): Promise<{ broadcastId: string; recipientCount: number }> {
  const recipients = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(audienceWhere(input.audience));

  const branding = await getEmailBranding(db);

  const messages: OutboxMessage[] = recipients.map((u) => {
    const { pageUrl, headers } = buildUnsubscribeLinks(input.siteUrl, u.id, input.secret);
    const tpl = emailTemplates.broadcast(input.siteName, input.subject, input.bodyText, {
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      unsubscribeUrl: pageUrl,
      branding,
    });
    return {
      toEmail: u.email,
      userId: u.id,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      headers,
      category: 'broadcast',
    };
  });

  // Chunk the inserts so a large audience doesn't build one giant statement.
  for (let i = 0; i < messages.length; i += ENQUEUE_CHUNK) {
    await enqueueEmails(db, messages.slice(i, i + ENQUEUE_CHUNK));
  }

  const [row] = await db
    .insert(broadcasts)
    .values({
      subject: input.subject,
      bodyText: input.bodyText,
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      audience: input.audience,
      recipientCount: messages.length,
      sentById: input.sentBy,
    })
    .returning({ id: broadcasts.id });

  return { broadcastId: row!.id, recipientCount: messages.length };
}

export interface BroadcastSummary {
  id: string;
  subject: string;
  recipientCount: number;
  createdAt: Date;
}

/** Recent broadcasts for the admin history list. */
export async function listBroadcasts(db: DB, limit = 20): Promise<BroadcastSummary[]> {
  const rows = await db
    .select({
      id: broadcasts.id,
      subject: broadcasts.subject,
      recipientCount: broadcasts.recipientCount,
      createdAt: broadcasts.createdAt,
    })
    .from(broadcasts)
    .orderBy(desc(broadcasts.createdAt))
    .limit(Math.min(Math.max(1, limit), 100));
  return rows;
}
