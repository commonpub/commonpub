import { and, eq, isNull } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import { emailTemplates, getContestBySlug, getEmailBranding, isContestEditor, formatDeadlineUtc, renderEmailBlocks } from '@commonpub/server';
import { contestEmailTestSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/email-test — render one contest email (confirmation or
 * reminder) with the POSTed UNSAVED copy and DELIVER it as a test to either an
 * arbitrary email address or a chosen user (the server resolves that user's email;
 * a client-supplied address is never trusted for a userId). Same organizer gate +
 * safety model as the live preview. The subject is prefixed with "[TEST]" so the
 * recipient can tell it apart. Sends directly via the configured email adapter
 * (console sink when no transport is configured — the send still "succeeds").
 */
export default defineEventHandler(async (event): Promise<{ sent: true; to: string }> => {
  requireFeature('contests');
  requireFeature('contestEmailEditor');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const { template, copy, toEmail, toUserId } = await parseBody(event, contestEmailTestSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  // Resolve the recipient. For a userId we look the address up server-side and
  // never expose it; for an arbitrary address we use it verbatim (already
  // validated as a well-formed email by the schema).
  let recipientEmail: string;
  let recipientUsername: string;
  if (toUserId) {
    const [u] = await db
      .select({ email: users.email, username: users.username })
      .from(users)
      .where(and(eq(users.id, toUserId), isNull(users.deletedAt)))
      .limit(1);
    if (!u) throw createError({ statusCode: 404, statusMessage: 'User not found' });
    recipientEmail = u.email;
    recipientUsername = u.username;
  } else {
    recipientEmail = toEmail!;
    recipientUsername = toEmail!.split('@')[0] || 'there';
  }

  const config = useConfig();
  const siteName = config.instance.name || 'CommonPub';
  const origin = getRequestURL(event).origin;
  const contestUrl = `${origin}/contests/${contest.slug}`;
  const deadline = formatDeadlineUtc(contest.endDate);
  const branding = await getEmailBranding(db);
  const unsub = `${origin}/unsubscribe`;
  const tokens = {
    username: recipientUsername,
    contestTitle: contest.title,
    deadline: deadline ?? '',
    timeRemaining: '24 hours',
    contestUrl,
  };
  const body = renderEmailBlocks(copy?.bodyBlocks, { accent: branding?.accentColor, tokens });
  const copyForTemplate = {
    subject: copy?.subject,
    intro: copy?.intro,
    bodyHtml: body.html || undefined,
    bodyText: body.text || undefined,
  };

  const rendered =
    template === 'reminder'
      ? emailTemplates.contestDeadlineReminder(
          siteName,
          recipientUsername,
          { title: contest.title, url: contestUrl, deadline, timeRemaining: '24 hours' },
          unsub,
          branding,
          copyForTemplate,
        )
      : emailTemplates.contestRegistrationConfirmation(
          siteName,
          recipientUsername,
          { title: contest.title, url: contestUrl, deadline },
          unsub,
          branding,
          copyForTemplate,
        );

  const adapter = useEmailAdapter();
  await adapter.send({
    to: recipientEmail,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: `(This is a test email.)\n\n${rendered.text}`,
  });

  return { sent: true, to: recipientEmail };
});
