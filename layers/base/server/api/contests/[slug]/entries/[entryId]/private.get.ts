import { getContestBySlug, getContestEntry, canViewContest, getEntryPrivateData, isContestEditor, isContestJudge } from '@commonpub/server';
import type { EntryPrivateData } from '@commonpub/server';

/**
 * GET /api/contests/:slug/entries/:entryId/private
 * Entrant PII + agreement acceptances for one entry. This is the ONLY way to
 * read PII — it never travels through the normal entries endpoints. Gated by the
 * `contest.pii` permission (admin; staff/others only when RBAC is enabled and the
 * grant is assigned) OR the requester being the entrant (own PII). Returns an empty
 * shape when the entry has no stored PII/agreements.
 */
export default defineEventHandler(async (event): Promise<EntryPrivateData> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  // PII response — never cache it (browser HTTP cache, bfcache, or any intermediary).
  setHeader(event, 'Cache-Control', 'no-store');
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

  // Authz: the entrant reads their own PII. Everyone else needs BOTH the
  // contest.pii permission AND a per-contest organizer/judge scope on THIS contest —
  // an instance-wide contest.pii grant alone must not cross into another contest's
  // entrant PII (mirrors the per-contest scoping the registrants/files routes use).
  const isEntrant = user.id === entry.userId;
  const canManage =
    user.id === contest.createdById ||
    hasPermission(event, 'contest.manage') ||
    (await isContestEditor(db, contest.id, user.id));
  const isJudge = await isContestJudge(db, contest.id, user.id);
  if (!isEntrant && !(hasPermission(event, 'contest.pii') && (canManage || isJudge))) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to entrant personal data' });
  }

  const data = await getEntryPrivateData(db, entryId);
  // Always anchor contestId/userId to the validated context (getEntryPrivateData
  // can't fill them when an entry has agreements but no stored PII row).
  return {
    contestId: contest.id,
    entryId,
    userId: entry.userId,
    fields: data?.fields ?? {},
    updatedAt: data?.updatedAt ?? new Date(0),
    agreements: data?.agreements ?? [],
  };
});
