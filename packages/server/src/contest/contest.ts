import { eq, and, isNotNull } from 'drizzle-orm';
import { contests, contestEntries, contestJudges, contestStakeholders } from '@commonpub/schema';
import type { ContestStatus } from '@commonpub/schema';
import type { DB } from '../types.js';
import { isContestEditor } from './stakeholders.js';
import { toContestDetail, getContestBySlug } from './read.js';
import { calculateContestRanks } from './entries.js';
import type { ContestDetail, CreateContestInput } from './types.js';

// Contest CRUD + lifecycle. The read/listing path lives in entries.ts, the pure
// stage helpers in stages.ts, judging/advancement in judging.ts, and the
// per-stage submission + proposal flows in submissions.ts. This module owns the
// create/update/delete writers and the status state machine.

/**
 * Check if a user role is allowed to create contests based on the instance policy.
 *
 * @param userRole - The user's role (member, pro, verified, staff, admin)
 * @param policy - The contest creation policy ('open' | 'staff' | 'admin')
 * @returns true if the user can create contests
 */
export function canCreateContest(
  userRole: string,
  policy: 'open' | 'staff' | 'admin' = 'admin',
): boolean {
  if (policy === 'open') return true;
  if (policy === 'staff') return userRole === 'staff' || userRole === 'admin';
  return userRole === 'admin';
}

export async function createContest(
  db: DB,
  input: CreateContestInput,
  options?: { userRole?: string; contestCreationPolicy?: 'open' | 'staff' | 'admin' },
): Promise<ContestDetail> {
  if (options?.userRole) {
    const policy = options.contestCreationPolicy ?? 'admin';
    if (!canCreateContest(options.userRole, policy)) {
      throw new Error(`Insufficient permissions: contest creation requires ${policy} role`);
    }
  }
  // Atomic: the contest row and its seeded judges/stakeholders must commit
  // together, so a failed seed (e.g. a bad judge id) can't leave a contest
  // missing the judges/reviewers the organizer asked for.
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(contests)
      .values({
        title: input.title,
        slug: input.slug,
        subheading: input.subheading ?? null,
        description: input.description ?? null,
        rules: input.rules ?? null,
        prizesDescription: input.prizesDescription ?? null,
        descriptionFormat: input.descriptionFormat ?? 'markdown',
        rulesFormat: input.rulesFormat ?? 'markdown',
        prizesDescriptionFormat: input.prizesDescriptionFormat ?? 'markdown',
        descriptionBlocks: input.descriptionBlocks ?? null,
        rulesBlocks: input.rulesBlocks ?? null,
        prizesBlocks: input.prizesBlocks ?? null,
        showPrizes: input.showPrizes ?? true,
        stages: input.stages ?? [],
        // Only keep currentStageId if it references a stage that actually exists.
        currentStageId: input.currentStageId && (input.stages ?? []).some((s) => s.id === input.currentStageId) ? input.currentStageId : null,
        bannerUrl: input.bannerUrl ?? null,
        bannerMeta: input.bannerMeta ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        coverMeta: input.coverMeta ?? null,
        coverPlacement: input.coverPlacement ?? null,
        prizes: input.prizes ?? null,
        judgingCriteria: input.judgingCriteria ?? null,
        communityVotingEnabled: input.communityVotingEnabled ?? false,
        judgingVisibility: input.judgingVisibility ?? 'judges-only',
        eligibleContentTypes: input.eligibleContentTypes ?? null,
        maxEntriesPerUser: input.maxEntriesPerUser ?? null,
        visibility: input.visibility ?? 'public',
        visibleToRoles: input.visibleToRoles ?? null,
        emailCopy: input.emailCopy ?? null,
        registrationTemplate: input.registrationTemplate ?? [],
        registrationMode: input.registrationMode ?? 'light',
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        judgingEndDate: input.judgingEndDate ? new Date(input.judgingEndDate) : null,
        createdById: input.createdBy,
      })
      .returning();

    // Single source of truth: seed the contest_judges table from any judge IDs
    // provided at creation. The legacy `judges` jsonb column is no longer written
    // or read — authorization + display use the table exclusively.
    if (input.judges && input.judges.length > 0) {
      await tx
        .insert(contestJudges)
        .values(input.judges.map((userId) => ({ contestId: inserted!.id, userId })))
        .onConflictDoNothing();
    }
    // Seed stakeholders (view-only reviewers) from create input.
    if (input.stakeholders && input.stakeholders.length > 0) {
      await tx
        .insert(contestStakeholders)
        .values(input.stakeholders.map((userId) => ({ contestId: inserted!.id, userId })))
        .onConflictDoNothing();
    }

    return inserted!;
  });

  return toContestDetail(row);
}

/**
 * Update a contest. Authorized for the owner, a per-contest `editor` stakeholder,
 * or a caller the route already cleared via `contest.manage` (`canManage=true`).
 * Returns null when the contest is missing OR the caller is not authorized.
 */
export async function updateContest(
  db: DB,
  slug: string,
  userId: string,
  data: Partial<CreateContestInput>,
  canManage = false,
): Promise<ContestDetail | null> {
  const existing = await db
    .select()
    .from(contests)
    .where(eq(contests.slug, slug))
    .limit(1);

  if (existing.length === 0) return null;
  const isOwner = existing[0]!.createdById === userId;
  if (!isOwner && !canManage && !(await isContestEditor(db, existing[0]!.id, userId))) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.subheading !== undefined) updates.subheading = data.subheading;
  if (data.description !== undefined) updates.description = data.description;
  if (data.rules !== undefined) updates.rules = data.rules;
  if (data.prizesDescription !== undefined) updates.prizesDescription = data.prizesDescription;
  if (data.descriptionFormat !== undefined) updates.descriptionFormat = data.descriptionFormat;
  if (data.rulesFormat !== undefined) updates.rulesFormat = data.rulesFormat;
  if (data.prizesDescriptionFormat !== undefined) updates.prizesDescriptionFormat = data.prizesDescriptionFormat;
  if (data.descriptionBlocks !== undefined) updates.descriptionBlocks = data.descriptionBlocks;
  if (data.rulesBlocks !== undefined) updates.rulesBlocks = data.rulesBlocks;
  if (data.prizesBlocks !== undefined) updates.prizesBlocks = data.prizesBlocks;
  if (data.bannerUrl !== undefined) updates.bannerUrl = data.bannerUrl;
  if (data.bannerMeta !== undefined) updates.bannerMeta = data.bannerMeta;
  if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl;
  if (data.coverMeta !== undefined) updates.coverMeta = data.coverMeta;
  if (data.coverPlacement !== undefined) updates.coverPlacement = data.coverPlacement;
  if (data.showPrizes !== undefined) updates.showPrizes = data.showPrizes;
  if (data.stages !== undefined) updates.stages = data.stages;
  if (data.currentStageId !== undefined) updates.currentStageId = data.currentStageId;
  // Keep currentStageId consistent with the stages array: when stages change,
  // drop a pointer that no longer resolves (e.g. reset-to-standard sends stages=[]).
  if (data.stages !== undefined) {
    const desired = data.currentStageId !== undefined ? data.currentStageId : existing[0]!.currentStageId;
    if (!desired || !data.stages.some((s) => s.id === desired)) updates.currentStageId = null;
  }
  if (data.prizes !== undefined) updates.prizes = data.prizes;
  if (data.judgingCriteria !== undefined) updates.judgingCriteria = data.judgingCriteria;
  // `judges` is intentionally not handled here — the contest_judges table is the
  // source of truth, managed via the dedicated /judges endpoints.
  if (data.communityVotingEnabled !== undefined) updates.communityVotingEnabled = data.communityVotingEnabled;
  if (data.judgingVisibility !== undefined) updates.judgingVisibility = data.judgingVisibility;
  if (data.eligibleContentTypes !== undefined) updates.eligibleContentTypes = data.eligibleContentTypes;
  if (data.maxEntriesPerUser !== undefined) updates.maxEntriesPerUser = data.maxEntriesPerUser;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.visibleToRoles !== undefined) updates.visibleToRoles = data.visibleToRoles;
  // Per-contest email copy override (session 232). Null clears it (revert to
  // built-in default copy). Organizer-only; never returned in public responses.
  if (data.emailCopy !== undefined) updates.emailCopy = data.emailCopy;
  if (data.registrationTemplate !== undefined) updates.registrationTemplate = data.registrationTemplate;
  if (data.registrationMode !== undefined) updates.registrationMode = data.registrationMode;
  if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);
  if (data.judgingEndDate !== undefined) updates.judgingEndDate = data.judgingEndDate ? new Date(data.judgingEndDate) : null;

  // Editable slug: when changed, ensure it isn't taken by another contest. The
  // old URL stops resolving (no redirect) — the caller navigates to the new slug.
  let finalSlug = slug;
  if (data.slug !== undefined && data.slug && data.slug !== existing[0]!.slug) {
    const taken = await db.select({ id: contests.id }).from(contests).where(eq(contests.slug, data.slug)).limit(1);
    if (taken.length && taken[0]!.id !== existing[0]!.id) throw new Error('SLUG_TAKEN');
    updates.slug = data.slug;
    finalSlug = data.slug;
  }

  await db.update(contests).set(updates).where(eq(contests.slug, slug));

  return getContestBySlug(db, finalSlug);
}

// --- Contest Management ---

export async function deleteContest(
  db: DB,
  contestId: string,
  userId: string,
  /**
   * When true, skip the owner check — the caller has already established a
   * managing permission (RBAC `contest.manage`) at the route boundary. Mirrors
   * `deleteEvent`'s `isAdmin` flag. Defaults false ⇒ legacy owner-only.
   */
  canManage = false,
): Promise<boolean> {
  const contest = await db
    .select({ createdById: contests.createdById })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return false;
  if (!canManage && contest[0]!.createdById !== userId) return false;

  await db.delete(contests).where(eq(contests.id, contestId));
  return true;
}

// Bidirectional lifecycle: stages can move forward OR back (go-back), a running
// contest can be deactivated to `paused` without cancelling (and resumed), and
// terminal states can be reopened. `draft` = created but not launched.
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['upcoming', 'active', 'cancelled'],
  upcoming: ['draft', 'active', 'cancelled'],
  active: ['upcoming', 'paused', 'judging', 'cancelled'],
  paused: ['active', 'upcoming', 'judging', 'cancelled'],
  judging: ['active', 'paused', 'completed', 'cancelled'],
  completed: ['judging'],
  cancelled: ['draft', 'upcoming'],
};

/** Format an integer rank as an ordinal: 1 → "1st", 2 → "2nd", 11 → "11th". */
function ordinalPlace(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export async function transitionContestStatus(
  db: DB,
  contestId: string,
  userId: string,
  newStatus: ContestStatus,
  canManage = false,
): Promise<{ transitioned: boolean; error?: string }> {
  const contest = await db
    .select({ createdById: contests.createdById, status: contests.status })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (contest.length === 0) return { transitioned: false, error: 'Contest not found' };
  if (contest[0]!.createdById !== userId && !canManage && !(await isContestEditor(db, contestId, userId))) {
    return { transitioned: false, error: 'Not authorized to manage this contest' };
  }

  const currentStatus = contest[0]!.status;
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(newStatus)) {
    return { transitioned: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  // Status flip + (on completion) rank calculation must be atomic so we never
  // leave a 'completed' contest with stale/partial ranks.
  await db.transaction(async (tx) => {
    await tx
      .update(contests)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(contests.id, contestId));

    if (newStatus === 'completed') {
      await calculateContestRanks(tx, contestId);
    }
  });

  // Combined-mode launch: create the deferred draft entries for participants who
  // registered while the contest was `upcoming` (best-effort, bounded, idempotent).
  if (newStatus === 'active') {
    try {
      const { backfillCombinedEntries } = await import('./submissions.js');
      // Drain the whole deferred tail — each call is bounded (500) so a huge
      // audience can't make ONE call a giant op, but we loop (idempotent) so
      // registrant #501+ isn't dropped. Cap iterations as a runaway backstop.
      for (let i = 0; i < 100; i += 1) {
        const { remaining } = await backfillCombinedEntries(db, contestId);
        if (!remaining) break;
      }
    } catch (err) {
      console.error('[contest] combined-entry backfill failed:', err instanceof Error ? err.message : err);
    }
  }

  // Notify contest entrants about status change (non-critical)
  try {
    const { createNotification } = await import('../notification/notification.js');
    const [contestInfo] = await db.select({ title: contests.title, slug: contests.slug, prizes: contests.prizes })
      .from(contests).where(eq(contests.id, contestId)).limit(1);

    if (contestInfo) {
      const entrants = await db.select({ userId: contestEntries.userId, rank: contestEntries.rank })
        .from(contestEntries).where(eq(contestEntries.contestId, contestId));

      const messages: Record<string, { title: string; message: string }> = {
        active: { title: 'Contest Open', message: `"${contestInfo.title}" is now accepting submissions!` },
        paused: { title: 'Contest Paused', message: `"${contestInfo.title}" has been temporarily paused.` },
        judging: { title: 'Judging Started', message: `"${contestInfo.title}" is now being judged.` },
        completed: { title: 'Results Posted', message: `Results for "${contestInfo.title}" are now available!` },
        cancelled: { title: 'Contest Cancelled', message: `"${contestInfo.title}" has been cancelled.` },
      };
      const msg = messages[newStatus];
      const link = `/contests/${contestInfo.slug}${newStatus === 'completed' ? '/results' : ''}`;

      if (newStatus === 'completed') {
        // Winner-aware: an entrant whose rank earns a place-prize (or, when no
        // place-prizes are defined, places in the top 3) gets a congratulatory
        // alert naming their placement + prize; everyone else gets the standard
        // "results posted" note.
        const placePrize = new Map<number, { title?: string; value?: string }>();
        for (const p of contestInfo.prizes ?? []) {
          if (typeof p.place === 'number') placePrize.set(p.place, { title: p.title, value: p.value });
        }
        const hasPlacePrizes = placePrize.size > 0;
        for (const entrant of entrants) {
          const rank = entrant.rank;
          const prize = rank != null ? placePrize.get(rank) : undefined;
          const isWinner = rank != null && (prize !== undefined || (!hasPlacePrizes && rank <= 3));
          if (isWinner) {
            const won = prize?.title ? ` and won ${prize.title}${prize.value ? ` (${prize.value})` : ''}` : '';
            createNotification(db, {
              userId: entrant.userId,
              type: 'contest',
              title: 'You won!',
              message: `Congratulations — you placed ${ordinalPlace(rank!)} in "${contestInfo.title}"${won}!`,
              link,
              actorId: userId,
            }).catch(() => {});
          } else if (msg) {
            createNotification(db, {
              userId: entrant.userId, type: 'contest', title: msg.title, message: msg.message, link, actorId: userId,
            }).catch(() => {});
          }
        }
      } else if (msg) {
        for (const entrant of entrants) {
          createNotification(db, {
            userId: entrant.userId, type: 'contest', title: msg.title, message: msg.message, link, actorId: userId,
          }).catch(() => {});
        }
      }

      // Also notify accepted judges on status transitions
      if (newStatus === 'judging' || newStatus === 'completed' || newStatus === 'cancelled') {
        const judges = await db.select({ userId: contestJudges.userId })
          .from(contestJudges)
          .where(and(eq(contestJudges.contestId, contestId), isNotNull(contestJudges.acceptedAt)));

        const judgeMsg = newStatus === 'judging'
          ? { title: 'Judging Period Started', message: `"${contestInfo.title}" is ready for judging.` }
          : (msg ?? { title: 'Contest Update', message: `"${contestInfo.title}" was updated.` });

        for (const judge of judges) {
          // Don't double-notify judges who are also entrants
          if (entrants.some(e => e.userId === judge.userId)) continue;
          createNotification(db, {
            userId: judge.userId,
            type: 'contest',
            title: judgeMsg.title,
            message: judgeMsg.message,
            link,
            actorId: userId,
          }).catch(() => {});
        }
      }
    }
  } catch { /* non-critical */ }

  return { transitioned: true };
}
