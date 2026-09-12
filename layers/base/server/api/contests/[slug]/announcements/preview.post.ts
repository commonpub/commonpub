import { announcementContext, announcementTokens, emailTemplates, getContestBySlug, getEmailBranding, isContestEditor, renderEmailBlocks } from '@commonpub/server';
import { contestAnnouncementPreviewSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/announcements/preview — render the UNSAVED composition
 * so the editor can show a live preview in a sandboxed iframe.
 *
 * Same safety model as the contest email-copy preview: the body is validated with
 * the same schema the send uses and rendered through the same `renderEmailBlocks`
 * choke point, so a preview can never render arbitrary organizer HTML.
 *
 * The signed-in organizer is the sample recipient, so `{username}` shows a real
 * substitution rather than a stray placeholder, and `siteUrl` is passed so the
 * preview shows the SAME absolute URLs a delivered mail carries. A root-relative
 * href would silently "work" in the preview iframe and break in the inbox.
 */
export default defineEventHandler(async (event): Promise<{ html: string; subject: string }> => {
  requireFeature('contests');
  requireFeature('contestBroadcast');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const { subject, bodyBlocks } = await parseBody(event, contestAnnouncementPreviewSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  const config = useConfig();
  const siteName = config.instance.name || 'CommonPub';
  const origin = getRequestURL(event).origin;
  const branding = await getEmailBranding(db);
  // The SAME token context the real send builds, so a token can never resolve
  // here and be missing (or different) in a delivered email.
  const context = announcementContext(contest, { siteName, siteUrl: origin });
  const contestUrl = context.contestUrl;

  // The signed-in organizer is the sample recipient, so the preview shows a real
  // substitution rather than a placeholder. AuthUser carries no display name, so
  // `{displayName}` falls back to the username exactly as it does for a real
  // recipient who has not set one.
  const tokens = announcementTokens(context, { username: user.username });
  const body = renderEmailBlocks(bodyBlocks, {
    tokens,
    accent: branding?.accentColor,
    siteUrl: origin,
    registrationUrl: `${contestUrl}/register`,
  });
  const rendered = emailTemplates.contestAnnouncement({
    siteName,
    subject,
    contest: { title: context.contestTitle, url: contestUrl },
    bodyHtml: body.html,
    bodyText: body.text,
    tokens,
    // A placeholder href keeps the system chrome visible in the preview.
    unsubscribeUrl: `${origin}/unsubscribe`,
    branding,
  });

  return { html: rendered.html, subject: rendered.subject };
});
