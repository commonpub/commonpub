import { emailTemplates } from '@commonpub/server';
import { emailBrandingSchema } from '@commonpub/schema';

/**
 * POST /api/admin/email-preview — render a representative email with the POSTed
 * (unsaved) branding so the admin editor can show a live preview. Validated with
 * the same schema as the save route, so the preview can't be used to render
 * arbitrary HTML. Returns the rendered HTML for an iframe.
 */
export default defineEventHandler(async (event): Promise<{ html: string; subject: string }> => {
  requireFeature('admin');
  const user = requirePermission(event, 'email.manage');
  const config = useConfig();
  const siteName = config.instance.name || 'CommonPub';
  const branding = await parseBody(event, emailBrandingSchema);

  // A digest sample exercises the header, accent links, action area, footer + unsubscribe.
  // Uses the signed-in admin's own username as the sample recipient (what they'd see).
  const template = emailTemplates.notificationDigest(
    siteName,
    user.username,
    [
      { text: 'Sam liked your project', url: '#' },
      { text: 'New follower: jordan', url: '#' },
      { text: 'Riley commented on your post', url: '#' },
    ],
    '#',
    branding,
  );
  return { html: template.html, subject: template.subject };
});
