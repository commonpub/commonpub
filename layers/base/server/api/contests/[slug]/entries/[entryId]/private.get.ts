import { getContestBySlug, getContestEntry, canViewContest, getEntryPrivateData } from '@commonpub/server';
import type { EntryPrivateData } from '@commonpub/server';

/**
 * GET /api/contests/:slug/entries/:entryId/private
 * Entrant PII + agreement acceptances for one entry. This is the ONLY way to
 * read PII — it never travels through the normal entries endpoints. Gated by the
 * `contest.pii` permission (admin/staff) OR the requester being the entrant
 * (own PII). Returns an empty shape when the entry has no stored PII/agreements.
 */
export default defineEventHandler(async (event): Promise<EntryPrivateData> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug, entryId } = parseParams(event, { slug: 'string', entryId: 'uuid' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const entry = await getContestEntry(db, entryId);
  if (!entry || entry.contestId !== contest.id) {
    throw createError({ statusCode: 404, statusMessage: 'Entry not found' });
  }

  // Authz: the entrant reads their own PII; everyone else needs contest.pii.
  const isEntrant = user.id === entry.userId;
  if (!isEntrant && !hasPermission(event, 'contest.pii')) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to entrant personal data' });
  }

  const data = await getEntryPrivateData(db, entryId);
  return (
    data ?? {
      contestId: contest.id,
      entryId,
      userId: entry.userId,
      fields: {},
      updatedAt: new Date(0),
      agreements: [],
    }
  );
});
