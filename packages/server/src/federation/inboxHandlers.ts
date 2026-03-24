/**
 * Inbox callback implementations — wires AP activities to database operations.
 * Used by both shared inbox and per-user inbox routes.
 */
import { eq, and, sql } from 'drizzle-orm';
import {
  activities,
  followRelationships,
  contentItems,
} from '@commonpub/schema';
import {
  buildAcceptActivity,
  type InboxCallbacks,
} from '@commonpub/protocol';
import type { DB } from '../types.js';
import { resolveRemoteActor } from './federation.js';

export interface InboxHandlerOptions {
  db: DB;
  domain: string;
  /** Auto-accept follow requests (default: true) */
  autoAcceptFollows?: boolean;
}

/**
 * Create inbox callbacks wired to database operations.
 */
export function createInboxHandlers(opts: InboxHandlerOptions): InboxCallbacks {
  const { db, domain, autoAcceptFollows = true } = opts;

  return {
    /**
     * Remote user wants to follow a local user.
     * Creates a follow relationship and optionally auto-accepts.
     */
    async onFollow(actorUri: string, targetActorUri: string, activityId: string): Promise<void> {
      // Resolve the remote actor (caches their public key, inbox, etc.)
      await resolveRemoteActor(db, actorUri);

      // Upsert follow relationship
      const existing = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, actorUri),
            eq(followRelationships.followingActorUri, targetActorUri),
          ),
        )
        .limit(1);

      let relationshipId: string;

      if (existing.length > 0) {
        relationshipId = existing[0]!.id;
        await db
          .update(followRelationships)
          .set({ status: autoAcceptFollows ? 'accepted' : 'pending', updatedAt: new Date() })
          .where(eq(followRelationships.id, relationshipId));
      } else {
        const [row] = await db
          .insert(followRelationships)
          .values({
            followerActorUri: actorUri,
            followingActorUri: targetActorUri,
            status: autoAcceptFollows ? 'accepted' : 'pending',
          })
          .returning();
        relationshipId = row!.id;
      }

      // Log inbound activity
      await db.insert(activities).values({
        type: 'Follow',
        actorUri,
        objectUri: targetActorUri,
        payload: { type: 'Follow', actor: actorUri, object: targetActorUri, id: activityId },
        direction: 'inbound',
        status: 'processed',
      });

      // Auto-accept: queue outbound Accept activity
      if (autoAcceptFollows) {
        const acceptActivity = buildAcceptActivity(domain, targetActorUri, activityId);
        await db.insert(activities).values({
          type: 'Accept',
          actorUri: targetActorUri,
          objectUri: actorUri,
          payload: acceptActivity,
          direction: 'outbound',
          status: 'pending',
        });
      }
    },

    /**
     * Remote instance accepted our Follow request.
     */
    async onAccept(actorUri: string, objectId: string): Promise<void> {
      // Find the pending follow relationship where we are the follower
      // objectId is the original Follow activity URI
      const pending = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followingActorUri, actorUri),
            eq(followRelationships.status, 'pending'),
          ),
        )
        .limit(1);

      if (pending.length > 0) {
        await db
          .update(followRelationships)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(followRelationships.id, pending[0]!.id));
      }

      await db.insert(activities).values({
        type: 'Accept',
        actorUri,
        objectUri: objectId,
        payload: {},
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote instance rejected our Follow request.
     */
    async onReject(actorUri: string, objectId: string): Promise<void> {
      const pending = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followingActorUri, actorUri),
            eq(followRelationships.status, 'pending'),
          ),
        )
        .limit(1);

      if (pending.length > 0) {
        await db
          .update(followRelationships)
          .set({ status: 'rejected', updatedAt: new Date() })
          .where(eq(followRelationships.id, pending[0]!.id));
      }

      await db.insert(activities).values({
        type: 'Reject',
        actorUri,
        objectUri: objectId,
        payload: {},
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote undid an action (unfollow, unlike).
     */
    async onUndo(actorUri: string, objectType: string, objectId: string): Promise<void> {
      if (objectType === 'Follow' || objectType === 'unknown') {
        // Remove the follow relationship
        await db
          .delete(followRelationships)
          .where(
            and(
              eq(followRelationships.followerActorUri, actorUri),
            ),
          );
      }

      if (objectType === 'Like') {
        // Remote unlike — decrement like count if we can identify the content
        // objectId is the Like activity URI, not the content URI, so this is best-effort
        await db.insert(activities).values({
          type: 'Undo',
          actorUri,
          objectUri: objectId,
          payload: { type: 'Undo', actor: actorUri, objectType, objectId },
          direction: 'inbound',
          status: 'processed',
        });
        return;
      }

      await db.insert(activities).values({
        type: 'Undo',
        actorUri,
        objectUri: objectId,
        payload: { type: 'Undo', actor: actorUri, objectType, objectId },
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote instance sent new content (Article/Note).
     * For v1: log the activity. Full content mirroring is a future feature.
     */
    async onCreate(actorUri: string, object: Record<string, unknown>): Promise<void> {
      await resolveRemoteActor(db, actorUri);

      await db.insert(activities).values({
        type: 'Create',
        actorUri,
        objectUri: (object.id as string) ?? null,
        payload: { type: 'Create', actor: actorUri, object },
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote instance updated content.
     * For v1: log the activity.
     */
    async onUpdate(actorUri: string, object: Record<string, unknown>): Promise<void> {
      await db.insert(activities).values({
        type: 'Update',
        actorUri,
        objectUri: (object.id as string) ?? null,
        payload: { type: 'Update', actor: actorUri, object },
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote instance deleted content.
     * For v1: log the activity.
     */
    async onDelete(actorUri: string, objectId: string): Promise<void> {
      await db.insert(activities).values({
        type: 'Delete',
        actorUri,
        objectUri: objectId,
        payload: {},
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote user liked local content.
     * Increment like count on the local content item.
     */
    async onLike(actorUri: string, objectUri: string): Promise<void> {
      await resolveRemoteActor(db, actorUri);

      // Try to find local content by its AP URI (https://domain/content/ID or https://domain/project/slug)
      // The objectUri might be the full URL of the content
      const url = new URL(objectUri).pathname;
      const segments = url.split('/').filter(Boolean);

      // Try matching /content/UUID or /type/slug patterns
      if (segments.length >= 2) {
        const idOrSlug = segments[segments.length - 1];
        // Try UUID match first
        const byId = await db
          .select({ id: contentItems.id })
          .from(contentItems)
          .where(eq(contentItems.id, idOrSlug!))
          .limit(1);

        if (byId.length > 0) {
          await db
            .update(contentItems)
            .set({ likeCount: sql`${contentItems.likeCount} + 1` })
            .where(eq(contentItems.id, byId[0]!.id));
        } else {
          // Try slug match
          const bySlug = await db
            .select({ id: contentItems.id })
            .from(contentItems)
            .where(eq(contentItems.slug, idOrSlug!))
            .limit(1);

          if (bySlug.length > 0) {
            await db
              .update(contentItems)
              .set({ likeCount: sql`${contentItems.likeCount} + 1` })
              .where(eq(contentItems.id, bySlug[0]!.id));
          }
        }
      }

      await db.insert(activities).values({
        type: 'Like',
        actorUri,
        objectUri,
        payload: {},
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote user boosted/shared local content.
     * For v1: log the activity.
     */
    async onAnnounce(actorUri: string, objectUri: string): Promise<void> {
      await db.insert(activities).values({
        type: 'Announce',
        actorUri,
        objectUri,
        payload: {},
        direction: 'inbound',
        status: 'processed',
      });
    },
  };
}
