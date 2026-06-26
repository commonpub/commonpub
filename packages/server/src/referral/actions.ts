import { eq } from 'drizzle-orm';
import { hubs, type ReferralAction } from '@commonpub/schema';
import type { DB } from '../types.js';
import { joinHub } from '../hub/members.js';

/**
 * Bounded onboarding-action executor + creation-time validator (plan §6).
 * Actions are a fixed whitelist that reference existing entities; there is no
 * scriptable surface. Every link-derived value is treated as untrusted.
 */

/**
 * Validate actions at link-creation time. `redirect` paths are already
 * same-origin-guarded by the Zod schema. For `join_hub` we reject targets the
 * referral system must not silently auto-join into: a missing hub, a private
 * hub (would leak membership), or an invite-only hub (needs a token we don't
 * mint in v1). Open + approval hubs are fine — `joinHub` handles them (approval
 * becomes a pending request).
 */
export async function validateReferralActions(
  db: DB,
  actions: ReferralAction[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const action of actions) {
    if (action.type === 'join_hub') {
      const [hub] = await db
        .select({ id: hubs.id, privacy: hubs.privacy, joinPolicy: hubs.joinPolicy })
        .from(hubs)
        .where(eq(hubs.id, action.hubId))
        .limit(1);
      if (!hub) return { ok: false, error: 'One of the selected hubs no longer exists' };
      if (hub.privacy === 'private') return { ok: false, error: 'Cannot auto-join a private hub' };
      if (hub.joinPolicy === 'invite') return { ok: false, error: 'Cannot auto-join an invite-only hub' };
    }
  }
  return { ok: true };
}

/**
 * Run a link's actions (side effects only) for a freshly-attributed user.
 * Best-effort + isolated per action so one failure cannot abort onboarding. The
 * redirect destination is derived separately (see attribution.deriveDestination)
 * so it stays correct even on an idempotent repeat claim. `redirect` is a pure
 * destination hint with no side effect here.
 */
export async function runReferralActions(
  db: DB,
  actions: ReferralAction[],
  userId: string,
): Promise<void> {
  for (const action of actions) {
    try {
      if (action.type === 'join_hub') {
        // Re-validate at CLAIM time: a hub can be flipped private (or deleted)
        // after the link was created, and joinHub has no privacy gate. Don't
        // auto-join a now-private/missing hub. joinHub still handles joinPolicy
        // (invite -> error, approval -> pending request).
        const [hub] = await db.select({ privacy: hubs.privacy }).from(hubs).where(eq(hubs.id, action.hubId)).limit(1);
        if (!hub || hub.privacy === 'private') continue;
        await joinHub(db, userId, action.hubId);
      }
    } catch (err) {
      console.error('[referral] action failed:', action.type, err instanceof Error ? err.message : err);
    }
  }
}
