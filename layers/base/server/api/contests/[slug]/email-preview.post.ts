import { emailTemplates, getContestBySlug, getEmailBranding, isContestEditor, formatDeadlineUtc } from '@commonpub/server';
import { contestEmailPreviewSchema } from '@commonpub/schema';

/**
 * POST /api/contests/:slug/email-preview — render one contest email (confirmation
 * or reminder) with the POSTed UNSAVED copy so the editor can show a live preview.
 * The copy is validated with the same field schema as the stored override, so the
 * preview can never render arbitrary HTML (the branding-preview safety model, per
 * contest). Sample token values are drawn from the real contest + a placeholder
 * participant. Gated on `contests` + `contestEmailEditor` + an authorized editor.
 */
export default defineEventHandler(async (event): Promise<{ html: string; subject: string }> => {
  requireFeature('contests');
  requireFeature('contestEmailEditor');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const { template, copy } = await parseBody(event, contestEmailPreviewSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  // Organizer-only: owner, a `contest.manage` holder, or a per-contest editor.
  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id));
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Not authorized' });

  const config = useConfig();
  const siteName = config.instance.name || 'CommonPub';
  const origin = getRequestURL(event).origin;
  const contestUrl = `${origin}/contests/${contest.slug}`;
  const deadline = formatDeadlineUtc(contest.endDate);
  const branding = await getEmailBranding(db);
  // A placeholder unsubscribe href keeps the system chrome visible in the preview.
  const sampleUnsub = `${origin}/unsubscribe`;

  // Preview uses the signed-in organizer's own username as the sample recipient
  // token, mirroring the real send substitution (`target.username`), so the
  // preview shows exactly what a recipient would see rather than a stray placeholder.
  const rendered =
    template === 'reminder'
      ? emailTemplates.contestDeadlineReminder(
          siteName,
          user.username,
          { title: contest.title, url: contestUrl, deadline, timeRemaining: '24 hours' },
          sampleUnsub,
          branding,
          copy,
        )
      : emailTemplates.contestRegistrationConfirmation(
          siteName,
          user.username,
          { title: contest.title, url: contestUrl, deadline },
          sampleUnsub,
          branding,
          copy,
        );

  return { html: rendered.html, subject: rendered.subject };
});
