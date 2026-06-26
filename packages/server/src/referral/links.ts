import { and, desc, eq } from 'drizzle-orm';
import {
  referralLinks,
  type ReferralLinkRow,
  type CreateReferralLinkInput,
  type UpdateReferralLinkInput,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { generateReferralCode, CODE_MAX_ATTEMPTS } from './codes.js';
import { validateReferralActions } from './actions.js';

export type CreateReferralLinkResult =
  | { ok: true; link: ReferralLinkRow }
  | { ok: false; error: string };

export type UpdateReferralLinkResult =
  | { ok: true; link: ReferralLinkRow }
  | { ok: false; error: string };

/**
 * Create a referral link for `ownerId`. A custom `input.code` (already
 * lowercased + validated by the Zod schema) is inserted once; a clash returns a
 * friendly error. With no code, a unique one is generated with bounded retry —
 * uniqueness rests on the DB index via `onConflictDoNothing`, never a racy
 * read-then-write.
 */
export async function createReferralLink(
  db: DB,
  ownerId: string,
  input: CreateReferralLinkInput,
  // `genCode` is an injection seam so the collision-retry loop is testable; it
  // defaults to the real generator.
  opts: { defaultWindowDays?: number; genCode?: () => string } = {},
): Promise<CreateReferralLinkResult> {
  const genCode = opts.genCode ?? generateReferralCode;
  const actions = input.actions ?? [];
  const valid = await validateReferralActions(db, actions);
  if (!valid.ok) return { ok: false, error: valid.error };

  const base = {
    ownerId,
    label: input.label ?? null,
    actions,
    landingPath: input.landingPath ?? null,
    attributionWindowDays: input.attributionWindowDays ?? opts.defaultWindowDays ?? 60,
  };

  if (input.code) {
    const [row] = await db
      .insert(referralLinks)
      .values({ ...base, code: input.code })
      .onConflictDoNothing()
      .returning();
    if (!row) return { ok: false, error: 'That code is already taken' };
    return { ok: true, link: row };
  }

  for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt++) {
    const [row] = await db
      .insert(referralLinks)
      .values({ ...base, code: genCode() })
      .onConflictDoNothing()
      .returning();
    if (row) return { ok: true, link: row };
  }
  return { ok: false, error: 'Could not generate a unique code, please try again' };
}

export async function listMyReferralLinks(db: DB, ownerId: string): Promise<ReferralLinkRow[]> {
  return db
    .select()
    .from(referralLinks)
    .where(eq(referralLinks.ownerId, ownerId))
    .orderBy(desc(referralLinks.createdAt), desc(referralLinks.id));
}

export async function getReferralLink(
  db: DB,
  ownerId: string,
  id: string,
): Promise<ReferralLinkRow | null> {
  const [row] = await db
    .select()
    .from(referralLinks)
    .where(and(eq(referralLinks.id, id), eq(referralLinks.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function updateReferralLink(
  db: DB,
  ownerId: string,
  id: string,
  input: UpdateReferralLinkInput,
): Promise<UpdateReferralLinkResult> {
  if (input.actions !== undefined) {
    const valid = await validateReferralActions(db, input.actions);
    if (!valid.ok) return { ok: false, error: valid.error };
  }

  const updates: Partial<typeof referralLinks.$inferInsert> = {};
  if (input.label !== undefined) updates.label = input.label;
  if (input.actions !== undefined) updates.actions = input.actions;
  if (input.landingPath !== undefined) updates.landingPath = input.landingPath;
  if (input.status !== undefined) updates.status = input.status;

  if (Object.keys(updates).length === 0) {
    const existing = await getReferralLink(db, ownerId, id);
    return existing ? { ok: true, link: existing } : { ok: false, error: 'Not found' };
  }

  const [row] = await db
    .update(referralLinks)
    .set(updates)
    .where(and(eq(referralLinks.id, id), eq(referralLinks.ownerId, ownerId)))
    .returning();
  if (!row) return { ok: false, error: 'Not found' };
  return { ok: true, link: row };
}

export async function deleteReferralLink(db: DB, ownerId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(referralLinks)
    .where(and(eq(referralLinks.id, id), eq(referralLinks.ownerId, ownerId)))
    .returning({ id: referralLinks.id });
  return deleted.length > 0;
}
