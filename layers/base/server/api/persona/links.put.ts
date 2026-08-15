import { setSharedLinkPlatforms } from '@commonpub/server';
import { z } from 'zod';
import { loadPersonaLinkSharing, type PersonaLinkSharingResponse } from './links.get';

/**
 * PUT /api/persona/links — replace the viewer's per-platform link sharing
 * choices (plan phase 3, R3.1 D6).
 *
 * WHOLE-SET REPLACEMENT, never a per-platform patch, and the reason is the same
 * one `PUT /api/persona` gives for its omittable-key map: a key the client
 * leaves out is CLEARED, not unchanged, which is what makes "untick everything"
 * actually work. A patch endpoint would make withdrawing the last platform
 * either impossible or a special case, and here the thing being withdrawn is a
 * disclosure.
 *
 * The route is thin on purpose. `setSharedLinkPlatforms` owns the effective
 * platform list, the unknown-key rejection, the template-scoped delete and the
 * row lock, all in one transaction. Nothing here decides what a platform is.
 *
 * GATED ON `persona`, NOT ON `dataSharingConsents`, matching `links.get.ts`. A
 * member's stored refusal must outlive an operator toggling the sharing flag
 * off and on: a grant may lapse when the terms move, a refusal may not. Nothing
 * is disclosed by the flag being off, so a write in the meantime authorises
 * nothing on its own; the directory still needs a current, digest-bound consent
 * grant before any of these platforms leaves the instance.
 */
const linkSharingWriteSchema = z
  .object({
    /**
     * The platforms the member chooses to share. `[]` is valid and meaningful:
     * it clears every one of them.
     *
     * Structural only. Whether a key names a platform this instance declares is
     * `setSharedLinkPlatforms`'s decision, made against the effective list; the
     * bounds here exist so an arbitrary string never travels further than this
     * line. 32 is the `varchar(32)` the column actually holds, and the array cap
     * is an envelope well above any plausible platform count.
     */
    platforms: z.array(z.string().min(1).max(32)).max(64),
  })
  .strict();

export default defineEventHandler(async (event): Promise<PersonaLinkSharingResponse> => {
  requireFeature('persona');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const { platforms } = await parseBody(event, linkSharingWriteSchema);

  const result = await setSharedLinkPlatforms(db, { userId: user.id, platforms, config });

  if (!result.ok) {
    // The same envelope `parseBody` throws on a Zod failure, so a client reads
    // ONE error shape for this route whether the rejection came from the
    // structural parse or from the platform-aware validation behind it.
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: { platforms: [result.error] } },
    });
  }

  // The FULL payload, not just what was written. The client re-renders from the
  // server's truth rather than from its own optimistic guess, which is what
  // makes a failed write visibly revert instead of silently sticking.
  return await loadPersonaLinkSharing(db, config, user.id);
});
