import { and, eq, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { announcementContext, announcementTokens, emailTemplates, getContestBySlug, getEmailBranding, isContestEditor, renderEmailBlocks } from '@commonpub/server';
import { contestAnnouncementTestSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/announcements/test — deliver ONE copy of the unsaved
 * composition, so the organizer can read it in a real inbox before mailing
 * anybody else. The subject is prefixed "[TEST]" so it is unmistakable.
 *
 * Recipient: either an arbitrary address, or a chosen user whose address the
 * SERVER resolves (a client-supplied address is never trusted for a userId).
 *
 * Sends directly through the configured adapter rather than the outbox, because a
 * test is useless if it waits up to ten minutes for the drain worker. That also
 * means a test send works on an instance whose outbox is idle, which is exactly
 * the situation an operator is in while deciding whether to turn delivery on.
 */
export default defineEventHandler(async (event): Promise<{ sent: true; to: string }> => {
  requireFeature('contests');
  requireFeature('contestBroadcast');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const { subject, bodyBlocks, toEmail, toUserId } = await parseBody(event, contestAnnouncementTestSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  let recipientEmail: string;
  let recipientUsername: string;
  let recipientDisplayName: string;
  if (toUserId) {
    const [u] = await db
      .select({ email: users.email, username: users.username, displayName: users.displayName })
      .from(users)
      .where(and(eq(users.id, toUserId), isNull(users.deletedAt)))
      .limit(1);
    if (!u) throw createError({ statusCode: 404, statusMessage: 'User not found' });
    recipientEmail = u.email;
    recipientUsername = u.username;
    recipientDisplayName = u.displayName || u.username;
  } else {
    recipientEmail = toEmail!;
    recipientUsername = toEmail!.split('@')[0] || 'there';
    recipientDisplayName = recipientUsername;
  }

  const config = useConfig();
  const siteName = config.instance.name || 'CommonPub';
  const origin = getRequestURL(event).origin;
  const branding = await getEmailBranding(db);
  // The SAME token context the real send builds, so a token can never resolve
  // here and be missing (or different) in a delivered email.
  const context = announcementContext(contest, { siteName, siteUrl: origin });
  const contestUrl = context.contestUrl;

  const tokens = announcementTokens(context, { username: recipientUsername, displayName: recipientDisplayName });
  // A test goes to a real inbox, so block URLs MUST be absolute here too.
  const body = renderEmailBlocks(bodyBlocks, {
    tokens,
    accent: branding?.accentColor,
    siteUrl: origin,
    registrationUrl: `${contestUrl}/register`,
  });
  const rendered = emailTemplates.contestAnnouncement({
    siteName,
    subject,
    contest: { title: contest.title, url: contestUrl },
    bodyHtml: body.html,
    bodyText: body.text,
    tokens,
    unsubscribeUrl: `${origin}/unsubscribe`,
    branding,
  });

  const adapter = useEmailAdapter();
  await adapter.send({
    to: recipientEmail,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: `(This is a test email.)\n\n${rendered.text}`,
  });

  return { sent: true, to: recipientEmail };
});
