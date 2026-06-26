import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  referralLinks,
  referralAttributions,
  hubs,
  users,
  referralCodeSchema,
  type ReferralLinkRow,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { runReferralActions } from './actions.js';

// When we have no click time (cookieless `?ref=` path) a genuine signup is only
// seconds old, so 1h is a generous "is this a fresh account" gate.
const NEW_ACCOUNT_FALLBACK_MS = 60 * 60 * 1000;
// Clock-skew tolerance when comparing account creation to the recorded click.
const CLICK_SKEW_MS = 5 * 60 * 1000;

export interface ClaimResult {
  /** True only when THIS call recorded a new attribution (and ran the actions). */
  attributed: boolean;
  /** Where to send the new user post-signup, or null. Idempotent: the same value
   *  is returned whether this call recorded the attribution or a prior one did. */
  destination: string | null;
  reason?: 'invalid_code' | 'unknown_code' | 'self_referral' | 'not_new_user' | 'already_attributed';
}

export interface ResolvedReferral {
  code: string;
  ownerUsername: string;
  ownerDisplayName: string | null;
  label: string | null;
  /** Names of hubs the new user would be joined to (for the signup banner). */
  hubNames: string[];
}

function normalizeCode(raw: string): string | null {
  const parsed = referralCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Resolve where a referred user should land, from a link's actions. Pure
 * derivation (no side effects), so it returns the same destination whether the
 * actions just ran or ran on a prior claim. Priority: an explicit `redirect`
 * action, then the link's `landingPath`, then the first `join_hub` target's hub.
 */
async function deriveDestination(db: DB, link: ReferralLinkRow): Promise<string | null> {
  const actions = link.actions ?? [];
  for (const action of actions) {
    if (action.type === 'redirect') return action.path;
  }
  if (link.landingPath) return link.landingPath;
  const firstJoin = actions.find((a): a is Extract<typeof a, { type: 'join_hub' }> => a.type === 'join_hub');
  if (firstJoin) {
    // Only send them to the hub if it still exists and isn't private (matches the
    // claim-time join guard, so we never redirect to a hub they weren't joined to).
    const [hub] = await db.select({ slug: hubs.slug, privacy: hubs.privacy }).from(hubs).where(eq(hubs.id, firstJoin.hubId)).limit(1);
    if (hub && hub.privacy !== 'private') return `/hubs/${hub.slug}`;
  }
  return null;
}

/**
 * Record an attribution for a freshly-signed-up user and run the link's
 * onboarding actions. Idempotent + race-proof: `UNIQUE(referred_user_id)` means
 * only the first call inserts (runs actions / bumps the counter); concurrent or
 * repeat calls no-op but STILL return the correct destination (so the explicit
 * claim endpoint and the cookie backstop can race harmlessly). Safe to call from
 * both triggers.
 *
 * Guards: first-touch (`UNIQUE`), self-referral (owner via own link), and the
 * new-user gate — an existing account that merely clicks a link is not a signup.
 * With a click time (from the carrier cookie) the gate is "account created at or
 * after the click"; without one (cookieless `?ref`) it is "account created in the
 * last hour", which a real signup always satisfies.
 */
export async function claimReferral(
  db: DB,
  params: { userId: string; code: string; clickedAt?: Date; now?: Date },
): Promise<ClaimResult> {
  const code = normalizeCode(params.code);
  if (!code) return { attributed: false, destination: null, reason: 'invalid_code' };

  const [link] = await db
    .select()
    .from(referralLinks)
    .where(and(eq(referralLinks.code, code), eq(referralLinks.status, 'active')))
    .limit(1);
  if (!link) return { attributed: false, destination: null, reason: 'unknown_code' };

  // A suspended/deleted owner's links stop working (treated as unknown).
  const [owner] = await db.select({ status: users.status }).from(users).where(eq(users.id, link.ownerId)).limit(1);
  if (!owner || owner.status !== 'active') {
    return { attributed: false, destination: null, reason: 'unknown_code' };
  }

  if (link.ownerId === params.userId) {
    return { attributed: false, destination: null, reason: 'self_referral' };
  }

  // New-user gate: never attribute (or auto-join) an existing account.
  const now = params.now ?? new Date();
  const [acct] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);
  if (!acct) return { attributed: false, destination: null, reason: 'not_new_user' };
  const createdMs = acct.createdAt instanceof Date ? acct.createdAt.getTime() : new Date(acct.createdAt).getTime();
  const isNew = params.clickedAt
    ? createdMs >= params.clickedAt.getTime() - CLICK_SKEW_MS
    : createdMs >= now.getTime() - NEW_ACCOUNT_FALLBACK_MS;
  if (!isNew) return { attributed: false, destination: null, reason: 'not_new_user' };

  const inserted = await db
    .insert(referralAttributions)
    .values({
      referralLinkId: link.id,
      ownerId: link.ownerId,
      referredUserId: params.userId,
      status: 'confirmed',
      confirmedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: referralAttributions.id });

  if (inserted.length === 0) {
    // Already attributed. Return the destination of the link they were actually
    // attributed to (first-touch), so a racing/repeat claim still redirects right.
    const [existing] = await db
      .select({ linkId: referralAttributions.referralLinkId })
      .from(referralAttributions)
      .where(eq(referralAttributions.referredUserId, params.userId))
      .limit(1);
    let attributedLink = link;
    if (existing && existing.linkId !== link.id) {
      const [l] = await db.select().from(referralLinks).where(eq(referralLinks.id, existing.linkId)).limit(1);
      if (l) attributedLink = l;
    }
    return { attributed: false, destination: await deriveDestination(db, attributedLink), reason: 'already_attributed' };
  }

  await db
    .update(referralLinks)
    .set({ signupCount: sql`${referralLinks.signupCount} + 1` })
    .where(eq(referralLinks.id, link.id));

  await runReferralActions(db, link.actions ?? [], params.userId);
  return { attributed: true, destination: await deriveDestination(db, link) };
}

/**
 * Public, read-only lookup for the signup banner ("invited by X, you'll join
 * Y"). Returns null for an unknown/disabled/invalid code or a non-active owner.
 * Exposes only the owner's public identity + the target hub names.
 */
export async function resolveReferral(db: DB, rawCode: string): Promise<ResolvedReferral | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  const [row] = await db
    .select({
      code: referralLinks.code,
      label: referralLinks.label,
      actions: referralLinks.actions,
      ownerStatus: users.status,
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
    })
    .from(referralLinks)
    .innerJoin(users, eq(referralLinks.ownerId, users.id))
    .where(and(eq(referralLinks.code, code), eq(referralLinks.status, 'active')))
    .limit(1);
  if (!row || row.ownerStatus !== 'active') return null;

  const hubIds = (row.actions ?? [])
    .filter((a): a is Extract<typeof a, { type: 'join_hub' }> => a.type === 'join_hub')
    .map((a) => a.hubId);
  let hubNames: string[] = [];
  if (hubIds.length > 0) {
    // Public hubs only — this endpoint is anonymous, so it must not disclose the
    // name of a private/unlisted hub (a hub can be flipped private after the link
    // was created, slipping past the creation-time check).
    const rows = await db
      .select({ name: hubs.name })
      .from(hubs)
      .where(and(inArray(hubs.id, hubIds), eq(hubs.privacy, 'public')));
    hubNames = rows.map((r) => r.name);
  }

  return {
    code: row.code,
    ownerUsername: row.ownerUsername,
    ownerDisplayName: row.ownerDisplayName,
    label: row.label,
    hubNames,
  };
}

/**
 * Atomically record a click and return the active link (or null). One statement
 * — the hot `/r/:code` path never does a separate read + write.
 */
export async function recordReferralClick(db: DB, rawCode: string): Promise<ReferralLinkRow | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  const [link] = await db
    .update(referralLinks)
    .set({ clickCount: sql`${referralLinks.clickCount} + 1` })
    .where(and(eq(referralLinks.code, code), eq(referralLinks.status, 'active')))
    .returning();
  return link ?? null;
}
