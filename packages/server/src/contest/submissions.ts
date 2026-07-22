import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import {
  contests,
  contestEntries,
  contestRegistrations,
  contestAgreementAcceptances,
  contestEntryPrivateFields,
  contestRegistrationPrivateFields,
  files,
} from '@commonpub/schema';
import type { ContentType, ContestStageSubmission, FormField } from '@commonpub/schema';
import type { DB } from '../types.js';
import { countRows, rowsOf } from '../query.js';
import { createContent, deleteContent } from '../content/content.js';
import { normalizeStages, currentStage, isEliminated } from './stages.js';
import { validateSubmissionFields, hashTerms } from './validation.js';
import type { StageSource, AgreementAcceptanceInput, ContestTx } from './types.js';

// DB-backed submission writers. Pure validation/partition lives in validation.ts.

/**
 * DB-backed post-validation for `file` fields (P6). The pure validator only checks
 * the value is a uuid; this verifies the referenced upload is one the SUBMITTER
 * actually owns and that it lives in PRIVATE contest storage — so a user can't
 * smuggle someone else's file id or a public object into a "private" field — plus
 * per-field mime (`accept`) + size (`maxSizeKb`). Runs after validateSubmissionFields,
 * before the write, for BOTH registration and entry submissions. No-op when the
 * template has no file fields (or none were answered).
 */
export async function validateFileFields(
  db: DB,
  template: FormField[],
  values: Record<string, string>,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fileFields = template.filter((f) => f.type === 'file' && (values[f.key] ?? '').trim().length > 0);
  if (fileFields.length === 0) return { ok: true };

  const ids = fileFields.map((f) => values[f.key]!.trim());
  const rows = await db
    .select({ id: files.id, uploaderId: files.uploaderId, visibility: files.visibility, purpose: files.purpose, mimeType: files.mimeType, sizeBytes: files.sizeBytes })
    .from(files)
    .where(inArray(files.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const f of fileFields) {
    const row = byId.get(values[f.key]!.trim());
    // Must exist, be uploaded by THIS user, and be a PRIVATE contest object.
    if (!row || row.uploaderId !== userId || row.visibility !== 'private' || row.purpose !== 'contest') {
      return { ok: false, error: `${f.label}: that file is missing or not one you uploaded` };
    }
    if (f.accept) {
      const allowed = f.accept.split(',').map((s) => s.trim()).filter(Boolean);
      const ok = allowed.length === 0 || allowed.some((a) => a === row.mimeType || (a.endsWith('/*') && row.mimeType.startsWith(a.slice(0, -1))));
      if (!ok) return { ok: false, error: `${f.label}: file type not allowed` };
    }
    if (f.maxSizeKb != null && row.sizeBytes > f.maxSizeKb * 1024) {
      return { ok: false, error: `${f.label} is too large (max ${f.maxSizeKb} KB)` };
    }
  }
  return { ok: true };
}

/**
 * Which contest(s) a private file was LEGITIMATELY submitted to. A `file` answer is
 * stored as a bare `files.id` in a private-field jsonb (registration OR entry PII).
 * This reverse lookup lets `/api/files/[id]/raw` scope a non-owner read to the
 * organizers of the specific contest the file's OWNER submitted it to.
 *
 * SECURITY — the match is constrained to rows whose `user_id` equals the file's
 * `uploader_id`. This is the invariant that closes a uuid-injection: `validateFileFields`
 * guarantees a `file`-typed answer was uploaded by the submitter (uploaderId === userId),
 * so a legitimate reference ALWAYS sits in a private-field row owned by the file's
 * uploader. Without this guard, ANY value in the jsonb matches — so a `contest.pii`
 * holder could paste a victim's file uuid into a `pii:true` text/signature field of a
 * contest THEY organize (those field types skip `validateFileFields`) and then read the
 * victim's private bytes via the self-owned contest. Requiring `user_id = uploader_id`
 * makes the attacker's row (user_id = attacker ≠ uploader) never match. Returns [] for
 * a file not yet referenced by its owner's own submission — readable only by its owner.
 */
export async function contestIdsForPrivateFile(db: DB, fileId: string): Promise<string[]> {
  // The uploader subquery filter (indexed on user_id) narrows to just the file owner's
  // own submission rows before the non-sargable jsonb value scan — a handful of rows.
  const res = await db.execute(sql`
    SELECT DISTINCT contest_id FROM (
      SELECT contest_id FROM contest_registration_private_fields
        WHERE user_id = (SELECT uploader_id FROM files WHERE id = ${fileId})
          AND EXISTS (SELECT 1 FROM jsonb_each_text(fields) e WHERE e.value = ${fileId})
      UNION ALL
      SELECT contest_id FROM contest_entry_private_fields
        WHERE user_id = (SELECT uploader_id FROM files WHERE id = ${fileId})
          AND EXISTS (SELECT 1 FROM jsonb_each_text(fields) e WHERE e.value = ${fileId})
    ) refs
  `);
  return rowsOf<{ contest_id: string }>(res).map((r) => r.contest_id);
}

/**
 * Sweep ABANDONED private contest files: purpose=`contest`, visibility=`private`
 * uploads that (a) are older than `olderThanMs` and (b) are NOT referenced by their
 * OWNER's own submission (the same `user_id = uploader_id` invariant as the /raw
 * scoping — a smuggled reference by another user does NOT count as referenced).
 *
 * This bounds two things the audit flagged: an authenticated user uploading private
 * files that are never submitted (no natural cleanup path), and files that BECOME
 * unreferenced when their owner unregisters / withdraws / the contest is deleted
 * (the private-field rows cascade away but the file bytes previously orphaned). The
 * age gate keeps the normal upload→submit window (immediate) safe.
 *
 * `deletePrivateBytes` is injected by the caller (the Nitro plugin passes the storage
 * adapter) so this stays framework-agnostic. Per file: delete the bytes first, then
 * the DB row — a bytes-delete failure leaves the row for the next sweep to retry
 * (never orphans the reverse: a row without bytes). Bounded by `limit` per call.
 */
export async function sweepOrphanedContestFiles(
  db: DB,
  deletePrivateBytes: (storageKey: string) => Promise<void>,
  opts: { olderThanMs: number; limit: number },
): Promise<{ swept: number }> {
  const cutoff = new Date(Date.now() - opts.olderThanMs);
  const res = await db.execute(sql`
    SELECT f.id, f.storage_key FROM files f
    WHERE f.purpose = 'contest' AND f.visibility = 'private' AND f.created_at < ${cutoff}
      AND NOT EXISTS (
        SELECT 1 FROM contest_registration_private_fields p
        WHERE p.user_id = f.uploader_id
          AND EXISTS (SELECT 1 FROM jsonb_each_text(p.fields) e WHERE e.value = f.id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM contest_entry_private_fields p
        WHERE p.user_id = f.uploader_id
          AND EXISTS (SELECT 1 FROM jsonb_each_text(p.fields) e WHERE e.value = f.id::text)
      )
    LIMIT ${opts.limit}
  `);
  const candidates = rowsOf<{ id: string; storage_key: string }>(res);
  let swept = 0;
  for (const c of candidates) {
    try {
      await deletePrivateBytes(c.storage_key);
    } catch {
      // Leave the row so the next sweep retries the byte delete — never delete the
      // pointer while the bytes remain.
      continue;
    }
    await db.delete(files).where(eq(files.id, c.id));
    swept++;
  }
  return { swept };
}

/**
 * Persist the PII + agreement halves of a partitioned submission within an open
 * transaction. Scope is EITHER an entry (`entryId` + `stageId`) OR a registration
 * (`registrationId`) — exactly one (P1). PII is upserted into the scope's private
 * table (one row per entry/registration, merged with any prior PII so a later
 * write doesn't wipe an earlier one); agreements are appended as immutable
 * acceptance rows (terms hash + snapshot). For registration scope the agreement
 * insert is idempotent — an info-edit re-register records a given accept once per
 * (registration, field, terms-hash) via the dedup UNIQUE — so consent can't pile
 * up; entry acceptances stay append-only. No-op when both pii and agreements empty.
 */
export async function recordPrivateAndAgreements(
  tx: ContestTx,
  args: {
    contestId: string;
    userId: string;
    /** Entry scope — mutually exclusive with registrationId. */
    entryId?: string;
    /** Registration scope — mutually exclusive with entryId (P1). */
    registrationId?: string;
    /** Submission stage — entry scope only. */
    stageId?: string;
    pii: Record<string, string>;
    agreements: AgreementAcceptanceInput[];
    ip?: string | null;
  },
): Promise<void> {
  const { contestId, userId, entryId, registrationId, stageId, pii, agreements, ip } = args;
  if ((entryId == null) === (registrationId == null)) {
    throw new Error('recordPrivateAndAgreements requires exactly one of entryId/registrationId');
  }
  const isRegistration = registrationId != null;

  if (Object.keys(pii).length > 0) {
    if (isRegistration) {
      const [existing] = await tx
        .select({ fields: contestRegistrationPrivateFields.fields })
        .from(contestRegistrationPrivateFields)
        .where(eq(contestRegistrationPrivateFields.registrationId, registrationId))
        .for('update');
      const merged = { ...(existing?.fields ?? {}), ...pii };
      await tx
        .insert(contestRegistrationPrivateFields)
        .values({ contestId, registrationId, userId, fields: merged })
        .onConflictDoUpdate({
          target: contestRegistrationPrivateFields.registrationId,
          set: { fields: merged, updatedAt: new Date() },
        });
    } else {
      const [existing] = await tx
        .select({ fields: contestEntryPrivateFields.fields })
        .from(contestEntryPrivateFields)
        .where(eq(contestEntryPrivateFields.entryId, entryId!))
        .for('update');
      const merged = { ...(existing?.fields ?? {}), ...pii };
      await tx
        .insert(contestEntryPrivateFields)
        .values({ contestId, entryId: entryId!, userId, fields: merged })
        .onConflictDoUpdate({
          target: contestEntryPrivateFields.entryId,
          set: { fields: merged, updatedAt: new Date() },
        });
    }
  }

  if (agreements.length > 0) {
    const rows = agreements.map((a) => ({
      contestId,
      entryId: entryId ?? null,
      registrationId: registrationId ?? null,
      userId,
      stageId: stageId ?? null,
      fieldKey: a.fieldKey,
      termsHash: hashTerms(a.terms),
      termsSnapshot: a.terms,
      ip: ip ?? null,
    }));
    if (isRegistration) {
      // Idempotent re-register: dedup on the registration-scope UNIQUE so an
      // info-edit re-register doesn't duplicate a prior acceptance.
      await tx.insert(contestAgreementAcceptances).values(rows).onConflictDoNothing({
        target: [
          contestAgreementAcceptances.registrationId,
          contestAgreementAcceptances.fieldKey,
          contestAgreementAcceptances.termsHash,
        ],
      });
    } else {
      await tx.insert(contestAgreementAcceptances).values(rows);
    }
  }
}

/**
 * Submit (or update) an entrant's per-stage artifact: the filled template
 * values for one `submission` stage, snapshotted onto the entry's
 * `stageSubmissions`. Owner-only. The stage must be the contest's CURRENT
 * stage while the contest is `active` (status stays the gating truth — the
 * organizer maps a later submission round back to `active` when advancing).
 * Re-submitting while the stage is open replaces that stage's artifact.
 * Cohort gate: an entry culled at a prior review stage can no longer submit.
 */
export async function submitStageArtifact(
  db: DB,
  entryId: string,
  stageId: string,
  fields: Record<string, string>,
  userId: string,
  ip?: string | null,
): Promise<{ submitted: boolean; stageSubmissions?: ContestStageSubmission[]; error?: string }> {
  const fail = (error: string) => ({ submitted: false, error });

  const existing = await db
    .select({
      contestId: contestEntries.contestId,
      entrantId: contestEntries.userId,
      stageState: contestEntries.stageState,
      contestStatus: contests.status,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
    })
    .from(contestEntries)
    .innerJoin(contests, eq(contestEntries.contestId, contests.id))
    .where(eq(contestEntries.id, entryId))
    .limit(1);

  if (existing.length === 0) return fail('Entry not found');
  const row = existing[0]!;
  if (row.entrantId !== userId) return fail('Not the entry owner');

  if (row.contestStatus !== 'active') {
    return fail('Stage submissions are only open while the contest is active');
  }

  const source: StageSource = {
    status: row.contestStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    judgingEndDate: row.judgingEndDate,
    stages: row.stages,
    currentStageId: row.currentStageId,
  };
  const stages = normalizeStages(source);
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return fail('Unknown stage');
  if (stage.kind !== 'submission') return fail('This stage does not accept submissions');
  const template = stage.submissionTemplate ?? [];
  if (template.length === 0) return fail('This stage has no submission template');

  const current = currentStage(source);
  if (current?.id !== stageId) return fail('This stage is not currently open');

  // Cohort gate: once a review cut culled the field, eliminated entries are
  // out of every later round (mirrors judgeContestEntry's gate).
  if (isEliminated({ stageState: row.stageState })) {
    return fail('This entry was not advanced and can no longer submit');
  }

  const validated = validateSubmissionFields(template, fields);
  if (!validated.ok) return fail(validated.error);
  const fileCheck = await validateFileFields(db, template, fields, userId);
  if (!fileCheck.ok) return fail(fileCheck.error);
  const { artifact, pii, agreements } = validated.result;

  // Atomic read-modify-write: lock the entry row so two concurrent saves of
  // the same artifact can't clobber each other (same pattern as judgeScores).
  // PII + agreements (if the template has any) are persisted in the SAME tx so
  // they can never land in the public stageSubmissions jsonb.
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ stageSubmissions: contestEntries.stageSubmissions })
      .from(contestEntries)
      .where(eq(contestEntries.id, entryId))
      .for('update');

    const submissions = (locked?.stageSubmissions ?? []) as ContestStageSubmission[];
    const record: ContestStageSubmission = { stageId, fields: artifact, submittedAt: new Date().toISOString() };
    const idx = submissions.findIndex((s) => s.stageId === stageId);
    if (idx >= 0) submissions[idx] = record;
    else submissions.push(record);

    await tx
      .update(contestEntries)
      .set({ stageSubmissions: submissions })
      .where(eq(contestEntries.id, entryId));

    await recordPrivateAndAgreements(tx, { contestId: row.contestId, entryId, userId, stageId, pii, agreements, ip });

    return { submitted: true, stageSubmissions: submissions };
  });
}

// --- Form-first proposal submissions (Phase 4) ---

/** Content types a placeholder proposal project may be created as. */
const PLACEHOLDER_TYPES: readonly ContentType[] = ['project', 'blog', 'explainer'];

export interface SubmitProposalArgs {
  contestId: string;
  stageId: string;
  /** Raw entrant form values (template-key → string). */
  fields: Record<string, string>;
  userId: string;
  /** Best-effort client IP, recorded with any agreement acceptances. */
  ip?: string | null;
}

export type SubmitProposalResult =
  // `contentType` is the ACTUAL created type (after PLACEHOLDER_TYPES fallback +
  // createContent's article→blog normalization) so the client routes to the
  // right editor URL instead of guessing from eligibleContentTypes.
  | { ok: true; entryId: string; projectSlug: string; contentId: string; contentType: string }
  | { ok: false; error: string };

/**
 * Form-first proposal submission (Phase 4). For a `submission` stage in
 * `proposal` mode: validate the form, create a DRAFT placeholder project, link a
 * contest entry to it (relaxing the published-only gate that `submitContestEntry`
 * enforces), snapshot the artifact, record agreement acceptances, store PII in
 * the private table, and bump `entryCount`. The placeholder + the entry +
 * PII/agreements are written atomically: the placeholder is created first, then
 * the entry tx; if the entry tx fails the placeholder is removed (compensating
 * delete) so a failed submit never leaves an orphan draft.
 *
 * Flag (`features.contestProposals`) is enforced at the route; this fn enforces
 * the structural gate that the target stage is current + proposal-mode.
 */
export async function submitContestProposal(db: DB, args: SubmitProposalArgs): Promise<SubmitProposalResult> {
  const { contestId, stageId, fields, userId, ip } = args;
  const fail = (error: string): SubmitProposalResult => ({ ok: false, error });

  const [contest] = await db
    .select({
      id: contests.id,
      title: contests.title,
      status: contests.status,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
      maxEntriesPerUser: contests.maxEntriesPerUser,
      eligibleContentTypes: contests.eligibleContentTypes,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest) return fail('Contest not found');
  if (contest.status !== 'active') return fail('Proposals are only open while the contest is active');

  const source: StageSource = {
    status: contest.status,
    startDate: contest.startDate,
    endDate: contest.endDate,
    judgingEndDate: contest.judgingEndDate,
    stages: contest.stages,
    currentStageId: contest.currentStageId,
  };
  const stage = normalizeStages(source).find((s) => s.id === stageId);
  if (!stage) return fail('Unknown stage');
  if (stage.kind !== 'submission') return fail('This stage does not accept submissions');
  if (stage.submissionMode !== 'proposal') return fail('This stage is not accepting proposals');
  if (currentStage(source)?.id !== stageId) return fail('This stage is not currently open');

  const template = stage.submissionTemplate ?? [];
  const validated = validateSubmissionFields(template, fields);
  if (!validated.ok) return fail(validated.error);
  const fileCheck = await validateFileFields(db, template, fields, userId);
  if (!fileCheck.ok) return fail(fileCheck.error);
  const { artifact, pii, agreements } = validated.result;

  // Per-user entry cap (mirrors submitContestEntry).
  if (contest.maxEntriesPerUser != null) {
    const existing = await countRows(
      db,
      contestEntries,
      and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)),
    );
    if (existing >= contest.maxEntriesPerUser) return fail('You have reached the entry limit for this contest');
  }

  // Pick the placeholder content type: the contest's first eligible type when
  // it's one we can create, else a project.
  const eligible = (contest.eligibleContentTypes ?? []).find((t) => PLACEHOLDER_TYPES.includes(t as ContentType));
  const placeholderType = (eligible ?? 'project') as ContentType;
  const title = artifact.title?.trim() || `${contest.title} proposal`;

  // 1) Create the DRAFT placeholder (its own writes). The entrant develops it in
  //    the editor; the proposal text lives in the stage artifact below.
  const placeholder = await createContent(db, userId, { type: placeholderType, title });

  // 2) Link the entry + persist artifact/PII/agreements/count atomically. On any
  //    failure, remove the placeholder so a failed submit leaves nothing behind.
  try {
    const entryId = await db.transaction(async (tx) => {
      // Serialize concurrent submits for this (contest,user); the cap pre-check above
      // is advisory (TOCTOU) and the fresh contentId means onConflictDoNothing can't
      // catch a double-submit. Re-check the cap under the lock.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`contest-entry:${contestId}:${userId}`}))`);
      if (contest.maxEntriesPerUser != null) {
        const [cnt] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(contestEntries)
          .where(and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)));
        if ((cnt?.n ?? 0) >= contest.maxEntriesPerUser) throw new Error('entry-cap');
      }
      const [inserted] = await tx
        .insert(contestEntries)
        .values({
          contestId,
          contentId: placeholder.id,
          userId,
          // Mark this entry as backed by an auto-created draft placeholder so a
          // later withdraw can clean up the stub (see withdrawContestEntry).
          placeholder: true,
          stageSubmissions: [{ stageId, fields: artifact, submittedAt: new Date().toISOString() }],
        })
        .onConflictDoNothing()
        .returning({ id: contestEntries.id });

      if (!inserted) throw new Error('entry-conflict');

      await tx
        .update(contests)
        .set({ entryCount: sql`${contests.entryCount} + 1` })
        .where(eq(contests.id, contestId));

      await recordPrivateAndAgreements(tx, { contestId, entryId: inserted.id, userId, stageId, pii, agreements, ip });

      // Submitting a proposal IS registering as a FULL participant: add the
      // entrant to the reminder audience so they never also have to click
      // "register" (idempotent, silent — deadline reminders still reach them via
      // this row). On conflict UPGRADE the tier to `full` so a prior
      // reminders-only opt-in who submits is counted (getRegistrantCount/list are
      // full-only); `fields` is left untouched to preserve any collected info.
      await tx
        .insert(contestRegistrations)
        .values({ contestId, userId })
        .onConflictDoUpdate({
          target: [contestRegistrations.contestId, contestRegistrations.userId],
          set: { tier: 'full' },
        });

      return inserted.id;
    });

    return { ok: true, entryId, projectSlug: placeholder.slug, contentId: placeholder.id, contentType: placeholder.type };
  } catch (err) {
    await deleteContent(db, placeholder.id, userId).catch(() => {});
    if (err instanceof Error && err.message === 'entry-conflict') {
      return fail('You already have an entry for this contest');
    }
    throw err;
  }
}

/**
 * COMBINED registration mode (P5): after a participant registers, also create a
 * DRAFT placeholder entry so they register + enter in one step. Reuses the proposal
 * placeholder mechanism (createContent draft → link a `contest_entries` row) but
 * with EMPTY stageSubmissions — the intake lives on the registration; this entry is
 * a stub the participant develops. Best-effort + idempotent + guarded:
 *  - no-op unless `registrationMode='combined'`, the contest is `active`, and the
 *    current stage is a `proposal`-mode submission stage (upcoming ⇒ deferred);
 *  - no-op if the participant already has ANY entry (re-register won't double-create);
 *  - respects `maxEntriesPerUser`.
 * A failure never rolls back the (already-committed) registration — the participant
 * stays registered and can enter via the normal flow; the placeholder is compensated.
 * Returns whether an entry was created (+ its id).
 */
export async function maybeCreateCombinedEntry(
  db: DB,
  contestId: string,
  userId: string,
  ip?: string | null,
): Promise<{ created: boolean; entryId?: string }> {
  const [contest] = await db
    .select({
      id: contests.id,
      title: contests.title,
      status: contests.status,
      registrationMode: contests.registrationMode,
      stages: contests.stages,
      currentStageId: contests.currentStageId,
      startDate: contests.startDate,
      endDate: contests.endDate,
      judgingEndDate: contests.judgingEndDate,
      maxEntriesPerUser: contests.maxEntriesPerUser,
      eligibleContentTypes: contests.eligibleContentTypes,
    })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);

  if (!contest || contest.registrationMode !== 'combined' || contest.status !== 'active') return { created: false };

  const source: StageSource = {
    status: contest.status,
    startDate: contest.startDate,
    endDate: contest.endDate,
    judgingEndDate: contest.judgingEndDate,
    stages: contest.stages,
    currentStageId: contest.currentStageId,
  };
  const cur = currentStage(source);
  if (!cur || cur.kind !== 'submission' || cur.submissionMode !== 'proposal') return { created: false };

  // Idempotent + per-user cap: skip if they already have an entry.
  const existing = await countRows(db, contestEntries, and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)));
  if (existing > 0) return { created: false };
  if (contest.maxEntriesPerUser != null && existing >= contest.maxEntriesPerUser) return { created: false };

  const eligible = (contest.eligibleContentTypes ?? []).find((t) => PLACEHOLDER_TYPES.includes(t as ContentType));
  const placeholderType = (eligible ?? 'project') as ContentType;
  const placeholder = await createContent(db, userId, { type: placeholderType, title: `${contest.title} entry` });

  try {
    const entryId = await db.transaction(async (tx) => {
      // Serialize concurrent create attempts for this (contest,user) — the count
      // pre-check above is advisory (TOCTOU), so a double-submit could otherwise
      // create two draft entries (each with a fresh contentId, so onConflictDoNothing
      // can't catch it). Re-check under the lock; the loser aborts + cleans up below.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`contest-entry:${contestId}:${userId}`}))`);
      const [cnt] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(contestEntries)
        .where(and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId)));
      if ((cnt?.n ?? 0) > 0) throw new Error('entry-conflict');
      const [inserted] = await tx
        .insert(contestEntries)
        .values({ contestId, contentId: placeholder.id, userId, placeholder: true, stageSubmissions: [] })
        .onConflictDoNothing()
        .returning({ id: contestEntries.id });
      if (!inserted) throw new Error('entry-conflict');
      await tx.update(contests).set({ entryCount: sql`${contests.entryCount} + 1` }).where(eq(contests.id, contestId));
      // The consent IP is captured on the registration acceptances already; the
      // stub entry carries no artifact, so nothing else to record here.
      void ip;
      return inserted.id;
    });
    return { created: true, entryId };
  } catch {
    await deleteContent(db, placeholder.id, userId).catch(() => {});
    return { created: false };
  }
}

/**
 * Launch backfill (P5): when a COMBINED contest transitions to `active`, create the
 * deferred draft entries for its FULL registrants who signed up while it was
 * `upcoming` (and don't yet have an entry). Bounded — processes at most `cap`
 * registrants per call so a huge audience can't make the transition a giant
 * synchronous op; returns how many were created + whether more remain. Idempotent
 * (maybeCreateCombinedEntry skips anyone who already has an entry), so a re-run
 * finishes the tail. No-op unless the contest is combined + active.
 */
export async function backfillCombinedEntries(
  db: DB,
  contestId: string,
  cap = 500,
): Promise<{ created: number; remaining: boolean }> {
  const [contest] = await db
    .select({ registrationMode: contests.registrationMode, status: contests.status })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);
  if (!contest || contest.registrationMode !== 'combined' || contest.status !== 'active') {
    return { created: 0, remaining: false };
  }

  // FULL registrants without an entry (up to cap+1 to detect a remaining tail).
  const missing = await db
    .select({ userId: contestRegistrations.userId })
    .from(contestRegistrations)
    .leftJoin(
      contestEntries,
      and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, contestRegistrations.userId)),
    )
    .where(and(
      eq(contestRegistrations.contestId, contestId),
      eq(contestRegistrations.tier, 'full'),
      isNull(contestEntries.id),
    ))
    .limit(cap + 1);

  const remaining = missing.length > cap;
  let created = 0;
  for (const { userId } of missing.slice(0, cap)) {
    const r = await maybeCreateCombinedEntry(db, contestId, userId);
    if (r.created) created += 1;
  }
  return { created, remaining };
}

export interface EntryPrivateData {
  contestId: string;
  entryId: string;
  userId: string;
  fields: Record<string, string>;
  updatedAt: Date;
  agreements: Array<{
    fieldKey: string;
    stageId: string;
    termsHash: string;
    termsSnapshot: string;
    acceptedAt: Date;
    /** Consent-audit IP captured at acceptance. Surfaced so the subject can see
     *  the data held about them (transparency) and organizers have the audit trail. */
    ip: string | null;
  }>;
}

/**
 * Read an entry's PII + agreement acceptances. NEVER reachable through the
 * normal entries endpoints — the calling route gates this on the `contest.pii`
 * permission OR the requester being the entrant. Returns null when the entry has
 * no stored PII and no agreements.
 */
export async function getEntryPrivateData(db: DB, entryId: string): Promise<EntryPrivateData | null> {
  const [priv] = await db
    .select()
    .from(contestEntryPrivateFields)
    .where(eq(contestEntryPrivateFields.entryId, entryId))
    .limit(1);

  const agreementRows = await db
    .select({
      fieldKey: contestAgreementAcceptances.fieldKey,
      stageId: contestAgreementAcceptances.stageId,
      termsHash: contestAgreementAcceptances.termsHash,
      termsSnapshot: contestAgreementAcceptances.termsSnapshot,
      acceptedAt: contestAgreementAcceptances.acceptedAt,
      ip: contestAgreementAcceptances.ip,
    })
    .from(contestAgreementAcceptances)
    .where(eq(contestAgreementAcceptances.entryId, entryId));
  // `stage_id` became nullable in P1 (registration-scoped acceptances have none),
  // but this read is ENTRY-scoped where stageId is always set — coerce to keep the
  // EntryPrivateData contract non-null.
  const agreements = agreementRows.map((a) => ({ ...a, stageId: a.stageId ?? '' }));

  if (!priv && agreements.length === 0) return null;

  return {
    contestId: priv?.contestId ?? '',
    entryId,
    userId: priv?.userId ?? '',
    fields: (priv?.fields ?? {}) as Record<string, string>,
    updatedAt: priv?.updatedAt ?? new Date(0),
    agreements,
  };
}
