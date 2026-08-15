import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import {
  currentPurposeScope,
  effectiveDataSharingDocument,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  listSharedLinkPlatforms,
  type DB,
} from '@commonpub/server';
import type { CommonPubConfig } from '@commonpub/config';

/**
 * GET /api/persona/links — the viewer's own per-platform link sharing choices
 * (plan phase 3, R3.1 D6).
 *
 * WHAT THIS IS NOT. It is not a link editor and it does not read or write a
 * single URL. The addresses live in `users.social_links`, `/settings/profile`
 * owns them, and the profile hero has printed them as its icon row since long
 * before persona existed. This route answers one narrower question per platform:
 * when a named recipient is handed this member's data, is THIS address included?
 *
 * ROW PRESENT MEANS SHARED (D6), so the default is off by construction. There is
 * no column with a default value that a later migration could flip, and a
 * platform an operator declares tomorrow is unshared for every member today
 * without anybody having to remember to write a row.
 *
 * ONLY PLATFORMS THE MEMBER HAS FILLED IN are returned. A toggle over a link
 * that does not exist is a control over nothing, and a list of every platform
 * the instance supports would read as a list of accounts this person has.
 *
 * GATED ON `persona`, NOT ON `dataSharingConsents`, and the asymmetry is
 * deliberate. The stored choice is the member's and must survive an operator
 * switching the sharing flag off to revise recipient copy and on again; a route
 * that 404s in between would make the settings page look broken and, worse,
 * would tempt a client into treating "cannot read" as "shares nothing".
 * Whether any sharing UI may be RENDERED is a different question, answered by
 * {@link PersonaLinkSharingResponse.sharingOffered} below.
 */

/** One platform the member has an address for, and their choice about it. */
export interface PersonaLinkSharingRow {
  /** The platform key, e.g. `github`. Matches `user_shared_links.platform`. */
  key: string;
  label: string;
  /**
   * The address as the member stored it.
   *
   * Returned so a member with two accounts can tell the rows apart, and the
   * client renders it as TEXT and never as an `href`. `users.social_links` holds
   * rows written long before the current URL validators, and this repo has
   * shipped a `javascript:` href twice; not rendering an anchor at all is
   * stronger than sanitising one. This is the member's own data, so returning it
   * to them discloses nothing new.
   */
  url: string;
  /** True when a row exists in `user_shared_links`. Absent means not shared. */
  shared: boolean;
}

export interface PersonaLinkSharingResponse {
  /**
   * Only platforms this member has actually filled in, in the operator's
   * declared platform order so the list matches the profile editor.
   */
  platforms: PersonaLinkSharingRow[];
  /**
   * True when at least one purpose that covers `profile_links` is offerable
   * right now: the `dataSharingConsents` flag is on AND a recipient with its
   * paperwork has been declared for such a purpose.
   *
   * DERIVED, not declared twice. The makerspace case (plan R2.3) is an instance
   * running `persona` with no recruitment, sponsor or analytics ambitions at
   * all, and on it no sharing language may appear anywhere. A client renders no
   * part of this control while this is false, and it is false for exactly the
   * instances where sharing cannot happen rather than for the ones where
   * somebody remembered to check a flag.
   */
  sharingOffered: boolean;
}

/**
 * The whole payload, for one member.
 *
 * Exported because `links.put.ts` answers with the SAME shape: a write that
 * returned only what it wrote would leave the client re-deriving the list it
 * already has, and two hand-built copies of one payload drift. The consent
 * routes next door share their builder for the same reason.
 */
export async function loadPersonaLinkSharing(
  db: DB,
  config: CommonPubConfig,
  userId: string,
): Promise<PersonaLinkSharingResponse> {
  const [platforms, sharedKeys, rows] = await Promise.all([
    effectivePersonaLinkPlatforms(db, config),
    listSharedLinkPlatforms(db, userId),
    // Read the one column rather than going through `getUserByUsername`, which
    // runs four aggregate queries for counts this route never looks at.
    db.select({ socialLinks: users.socialLinks }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  // The column's `$type` names the seven built-in platforms, but
  // `effectivePersonaLinkPlatforms` lets an operator declare more and
  // `setPersonaSection` writes those into the same object, so this reads it as
  // the open map it actually is rather than as the closed one it is typed as.
  const stored = (rows[0]?.socialLinks ?? {}) as Record<string, unknown>;
  const shared = new Set(sharedKeys);

  const out: PersonaLinkSharingRow[] = [];
  for (const platform of platforms) {
    const url = stored[platform.key];
    if (typeof url !== 'string' || url.trim() === '') continue;
    out.push({ key: platform.key, label: platform.label, url, shared: shared.has(platform.key) });
  }

  // `profile_links` is the data class both surviving purposes cover, so asking
  // whether it is in the offerable scope asks exactly "could a link of mine
  // reach a named recipient at all". The persona registry resolver is passed for
  // the reason `resolvePurposeScope` states next door: without it the scope is
  // computed over the config file's sections while everything else uses the
  // DB-resolved ones.
  const sharingOffered =
    config.features.dataSharingConsents === true &&
    (
      await currentPurposeScope(db, config, {
        sections: async () => (await effectivePersonaSchema(db, config)).sections,
        dataSharing: effectiveDataSharingDocument,
      })
    ).dataClasses.includes('profile_links');

  return { platforms: out, sharingOffered };
}

export default defineEventHandler(async (event): Promise<PersonaLinkSharingResponse> => {
  requireFeature('persona');
  const user = requireAuth(event);
  return await loadPersonaLinkSharing(useDB(), useConfig(), user.id);
});
