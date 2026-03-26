/**
 * Inbox callback implementations — wires AP activities to database operations.
 * Used by both shared inbox and per-user inbox routes.
 */
import { eq, and, sql, isNull } from 'drizzle-orm';
import {
  activities,
  followRelationships,
  contentItems,
  federatedContent,
  remoteActors,
} from '@commonpub/schema';
import {
  buildAcceptActivity,
  sanitizeHtml,
  type InboxCallbacks,
} from '@commonpub/protocol';
import type { DB } from '../types.js';
import { resolveRemoteActor } from './federation.js';
import { matchMirrorForContent } from './mirroring.js';

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

      if (existing.length > 0) {
        const relationshipId = existing[0]!.id;
        await db
          .update(followRelationships)
          .set({
            status: autoAcceptFollows ? 'accepted' : 'pending',
            activityUri: activityId,
            updatedAt: new Date(),
          })
          .where(eq(followRelationships.id, relationshipId));
      } else {
        const [row] = await db
          .insert(followRelationships)
          .values({
            followerActorUri: actorUri,
            followingActorUri: targetActorUri,
            activityUri: activityId,
            status: autoAcceptFollows ? 'accepted' : 'pending',
          })
          .returning();
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
     * Remote undid an action (unfollow, unlike, unboost).
     */
    async onUndo(actorUri: string, objectType: string, objectId: string): Promise<void> {
      if (objectType === 'Like' && objectId) {
        // Undo(Like): decrement like count on local or federated content
        try {
          const url = new URL(objectId).pathname;
          const segments = url.split('/').filter(Boolean);
          if (segments.length >= 2) {
            const idOrSlug = segments[segments.length - 1]!;
            // Try local content by slug
            const bySlug = await db
              .select({ id: contentItems.id, likeCount: contentItems.likeCount })
              .from(contentItems)
              .where(eq(contentItems.slug, idOrSlug))
              .limit(1);
            if (bySlug.length > 0 && bySlug[0]!.likeCount > 0) {
              await db
                .update(contentItems)
                .set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` })
                .where(eq(contentItems.id, bySlug[0]!.id));
            } else {
              // Try federated content by objectUri
              await db
                .update(federatedContent)
                .set({ localLikeCount: sql`GREATEST(${federatedContent.localLikeCount} - 1, 0)` })
                .where(eq(federatedContent.objectUri, objectId));
            }
          }
        } catch {
          // Invalid URL — skip decrement
        }
      } else if (objectType === 'Follow') {
        // Try exact match on activityUri first (most accurate)
        let deleted = false;
        if (objectId) {
          const byActivity = await db
            .select({ id: followRelationships.id })
            .from(followRelationships)
            .where(
              and(
                eq(followRelationships.followerActorUri, actorUri),
                eq(followRelationships.activityUri, objectId),
              ),
            )
            .limit(1);

          if (byActivity.length > 0) {
            await db
              .delete(followRelationships)
              .where(eq(followRelationships.id, byActivity[0]!.id));
            deleted = true;
          }
        }

        // Fallback: delete most recent follow from this actor (for AP implementations
        // that don't include the original activity URI in Undo)
        if (!deleted) {
          const existing = await db
            .select({ id: followRelationships.id })
            .from(followRelationships)
            .where(eq(followRelationships.followerActorUri, actorUri))
            .orderBy(sql`${followRelationships.updatedAt} DESC`)
            .limit(1);

          if (existing.length > 0) {
            await db
              .delete(followRelationships)
              .where(eq(followRelationships.id, existing[0]!.id));
          }
        }
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
     * Stores in federatedContent table with loop prevention.
     */
    async onCreate(actorUri: string, object: Record<string, unknown>): Promise<void> {
      const resolvedActor = await resolveRemoteActor(db, actorUri);

      const objectUri = object.id as string | undefined;
      const objectType = (object.type as string) ?? 'Article';

      // Loop prevention: reject content originating from our own domain
      if (objectUri) {
        try {
          const originHost = new URL(objectUri).hostname;
          if (originHost === domain) {
            // This is our own content echoed back — skip storage
            await db.insert(activities).values({
              type: 'Create',
              actorUri,
              objectUri,
              payload: { type: 'Create', actor: actorUri, object },
              direction: 'inbound',
              status: 'processed',
            });
            return;
          }
        } catch {
          // Invalid URL — continue with storage attempt
        }
      }

      // Extract origin domain from the object URI or actor URI
      let originDomain: string;
      try {
        originDomain = new URL(objectUri ?? actorUri).hostname;
      } catch {
        originDomain = 'unknown';
      }

      // Look up the remote actor's DB row for the FK
      let remoteActorId: string | null = null;
      if (resolvedActor) {
        const rows = await db
          .select({ id: remoteActors.id })
          .from(remoteActors)
          .where(eq(remoteActors.actorUri, actorUri))
          .limit(1);
        remoteActorId = rows[0]?.id ?? null;
      }

      // Parse and sanitize content
      const rawContent = typeof object.content === 'string' ? object.content : '';
      const sanitizedContent = sanitizeHtml(rawContent);

      // Extract tags
      const rawTags = Array.isArray(object.tag) ? object.tag : [];
      const tags = rawTags
        .filter((t): t is Record<string, string> => typeof t === 'object' && t !== null)
        .map((t) => ({ type: String(t.type ?? 'Hashtag'), name: String(t.name ?? '') }));

      // Extract attachments
      const rawAttachments = Array.isArray(object.attachment) ? object.attachment : [];
      const attachments = rawAttachments
        .filter((a): a is Record<string, string> => typeof a === 'object' && a !== null)
        .map((a) => ({ type: String(a.type ?? 'Document'), url: String(a.url ?? ''), name: a.name ? String(a.name) : undefined }));

      // Extract cover image from attachments or icon
      const coverImage = attachments.find((a) => a.type === 'Image')?.url
        ?? (typeof object.image === 'object' && object.image !== null ? (object.image as Record<string, string>).url : undefined);

      // Check for CommonPub extension
      const cpubType = typeof object['cpub:type'] === 'string' ? object['cpub:type'] : null;
      const cpubMetadata = object['cpub:metadata'] ?? null;

      // Check if this content matches an active mirror config
      const mirrorId = await matchMirrorForContent(db, originDomain, objectType, cpubType, tags);

      // Upsert federated content (objectUri is unique — prevents duplicates)
      if (objectUri) {
        await db
          .insert(federatedContent)
          .values({
            objectUri,
            actorUri,
            remoteActorId,
            originDomain,
            apType: objectType,
            title: typeof object.name === 'string' ? object.name : null,
            content: sanitizedContent || null,
            summary: typeof object.summary === 'string' ? sanitizeHtml(object.summary) : null,
            url: typeof object.url === 'string' ? object.url : null,
            coverImageUrl: coverImage ?? null,
            tags,
            attachments,
            inReplyTo: typeof object.inReplyTo === 'string' ? object.inReplyTo : null,
            cpubType,
            cpubMetadata,
            mirrorId,
            publishedAt: typeof object.published === 'string' ? new Date(object.published) : null,
          })
          .onConflictDoUpdate({
            target: federatedContent.objectUri,
            set: {
              content: sanitizedContent || null,
              title: typeof object.name === 'string' ? object.name : null,
              summary: typeof object.summary === 'string' ? sanitizeHtml(object.summary) : null,
              updatedAt: new Date(),
            },
          });
      }

      // If this is a reply (Note with inReplyTo), increment comment count on the parent
      const inReplyTo = typeof object.inReplyTo === 'string' ? object.inReplyTo : null;
      if (inReplyTo) {
        // Check if parent is local content (by slug match)
        try {
          const parentUrl = new URL(inReplyTo);
          const parentHost = parentUrl.hostname;

          if (parentHost === domain) {
            // Reply to local content — increment commentCount
            const parentSlug = parentUrl.pathname.split('/').filter(Boolean).pop();
            if (parentSlug) {
              await db
                .update(contentItems)
                .set({ commentCount: sql`${contentItems.commentCount} + 1` })
                .where(eq(contentItems.slug, parentSlug));
            }
          } else {
            // Reply to federated content — increment localCommentCount
            await db
              .update(federatedContent)
              .set({ localCommentCount: sql`${federatedContent.localCommentCount} + 1` })
              .where(eq(federatedContent.objectUri, inReplyTo));
          }
        } catch {
          // Invalid URL — skip comment counting
        }
      }

      // Log inbound activity
      await db.insert(activities).values({
        type: 'Create',
        actorUri,
        objectUri: objectUri ?? null,
        payload: { type: 'Create', actor: actorUri, object },
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote instance updated content.
     * Updates the corresponding federatedContent row if it exists.
     */
    async onUpdate(actorUri: string, object: Record<string, unknown>): Promise<void> {
      const objectUri = object.id as string | undefined;

      // Update stored federated content if we have it.
      // Only update fields that are explicitly provided — omitted fields are preserved.
      if (objectUri) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (typeof object.name === 'string') updates.title = object.name;
        if (typeof object.content === 'string') updates.content = sanitizeHtml(object.content);
        if (typeof object.summary === 'string') updates.summary = sanitizeHtml(object.summary);
        if (typeof object.url === 'string') updates.url = object.url;

        await db
          .update(federatedContent)
          .set(updates)
          .where(eq(federatedContent.objectUri, objectUri));
      }

      await db.insert(activities).values({
        type: 'Update',
        actorUri,
        objectUri: objectUri ?? null,
        payload: { type: 'Update', actor: actorUri, object },
        direction: 'inbound',
        status: 'processed',
      });
    },

    /**
     * Remote instance deleted content.
     * Soft-deletes the corresponding federatedContent row.
     */
    async onDelete(actorUri: string, objectId: string): Promise<void> {
      // Soft-delete federated content
      await db
        .update(federatedContent)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(federatedContent.objectUri, objectId),
            isNull(federatedContent.deletedAt),
          ),
        );

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
     * Remote user liked content (local or federated).
     * Increment like count on the matching content item.
     */
    async onLike(actorUri: string, objectUri: string): Promise<void> {
      await resolveRemoteActor(db, actorUri);

      // Try to find local content by its AP URI
      let url: string;
      try {
        url = new URL(objectUri).pathname;
      } catch {
        await db.insert(activities).values({
          type: 'Like',
          actorUri,
          objectUri,
          payload: {},
          direction: 'inbound',
          status: 'processed',
        });
        return;
      }
      const segments = url.split('/').filter(Boolean);

      let matched = false;

      // Try matching local content by slug or UUID
      if (segments.length >= 2) {
        const idOrSlug = segments[segments.length - 1]!;

        // Slug match first (canonical URI format)
        const bySlug = await db
          .select({ id: contentItems.id })
          .from(contentItems)
          .where(eq(contentItems.slug, idOrSlug))
          .limit(1);

        if (bySlug.length > 0) {
          await db
            .update(contentItems)
            .set({ likeCount: sql`${contentItems.likeCount} + 1` })
            .where(eq(contentItems.id, bySlug[0]!.id));
          matched = true;
        } else {
          // UUID fallback
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (UUID_RE.test(idOrSlug)) {
            const byId = await db
              .select({ id: contentItems.id })
              .from(contentItems)
              .where(eq(contentItems.id, idOrSlug))
              .limit(1);

            if (byId.length > 0) {
              await db
                .update(contentItems)
                .set({ likeCount: sql`${contentItems.likeCount} + 1` })
                .where(eq(contentItems.id, byId[0]!.id));
              matched = true;
            }
          }
        }
      }

      // If not local content, try federated content
      if (!matched) {
        await db
          .update(federatedContent)
          .set({ localLikeCount: sql`${federatedContent.localLikeCount} + 1` })
          .where(eq(federatedContent.objectUri, objectUri));
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
