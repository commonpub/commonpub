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
  users,
} from '@commonpub/schema';
import {
  buildAcceptActivity,
  sanitizeHtml,
  type InboxCallbacks,
} from '@commonpub/protocol';
import type { DB } from '../types.js';
import { resolveRemoteActor } from './federation.js';
import { matchMirrorForContent } from './mirroring.js';
import { createNotification } from '../notification/notification.js';

/** Helper: create a notification for a local user from a remote actor interaction */
async function notifyRemoteInteraction(
  db: DB,
  localUserId: string,
  type: 'like' | 'follow' | 'comment' | 'mention',
  actorUri: string,
  title: string,
  message: string,
  link?: string,
): Promise<void> {
  try {
    await createNotification(db, { userId: localUserId, type, title, message, link });
  } catch { /* notification creation is non-critical */ }
}

export interface InboxHandlerOptions {
  db: DB;
  domain: string;
  /** Auto-accept follow requests (default: true). Set to false for 'manual' policy. */
  autoAcceptFollows?: boolean;
  /** Config for federation behavior */
  federationConfig?: {
    backfillOnMirrorAccept?: boolean;
    mirrorMaxItems?: number;
  };
}

/**
 * Create inbox callbacks wired to database operations.
 */
export function createInboxHandlers(opts: InboxHandlerOptions): InboxCallbacks {
  const { db, domain, autoAcceptFollows = true } = opts;

  const handlers: InboxCallbacks = {
    /**
     * Remote user wants to follow a local user.
     * Creates a follow relationship and optionally auto-accepts.
     */
    async onFollow(actorUri: string, targetActorUri: string, activityId: string): Promise<void> {
      // Resolve the remote actor (caches their public key, inbox, etc.)
      await resolveRemoteActor(db, actorUri);

      // Upsert follow relationship (atomic — handles concurrent requests)
      await db
        .insert(followRelationships)
        .values({
          followerActorUri: actorUri,
          followingActorUri: targetActorUri,
          activityUri: activityId,
          status: autoAcceptFollows ? 'accepted' : 'pending',
        })
        .onConflictDoUpdate({
          target: [followRelationships.followerActorUri, followRelationships.followingActorUri],
          set: {
            status: autoAcceptFollows ? 'accepted' : 'pending',
            activityUri: activityId,
            updatedAt: new Date(),
          },
        });

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

      // Notify the local user about the new follower
      try {
        const targetSegments = new URL(targetActorUri).pathname.split('/').filter(Boolean);
        const targetUsername = targetSegments.pop();
        if (targetUsername) {
          const [localUser] = await db.select({ id: users.id }).from(users).where(eq(users.username, targetUsername)).limit(1);
          if (localUser) {
            const actorName = actorUri.split('/').pop() ?? actorUri;
            await notifyRemoteInteraction(db, localUser.id, 'follow', actorUri,
              'New follower', `${actorName} from the fediverse started following you`,
              '/notifications');
          }
        }
      } catch { /* non-critical */ }
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

        // Auto-backfill: if this Accept is for an instance mirror and config says to backfill
        if (opts.federationConfig?.backfillOnMirrorAccept) {
          try {
            const { getMirror, listMirrors } = await import('./mirroring.js');
            const mirrors = await listMirrors(db);
            const mirror = mirrors.find((m) => m.remoteActorUri === actorUri && m.direction === 'pull');
            if (mirror) {
              const { backfillFromOutbox } = await import('./backfill.js');
              // Fire and forget — don't block the Accept processing
              backfillFromOutbox(db, actorUri, domain, opts.federationConfig?.mirrorMaxItems).catch(
                (err: unknown) => console.error('[federation] auto-backfill failed:', err instanceof Error ? err.message : err),
              );
            }
          } catch { /* non-critical */ }
        }
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

        // Fallback: try to extract target from the activity payload
        if (!deleted) {
          // The Undo object should reference the original Follow, which contains
          // the target actor. Try parsing objectId as the original Follow's object.
          // If not possible, we cannot safely determine which follow to delete —
          // deleting by most-recent-followerActorUri could remove the wrong one.
          // Instead, log a warning and leave the relationship intact.
          console.warn(`[inbox] Undo(Follow) from ${actorUri} has no matching activityUri (objectId=${objectId}). Cannot determine target — relationship preserved.`);
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

      // Check for private/direct messages: Note with specific recipients, no #Public
      const toField = (object.to ?? []) as string[];
      const ccField = (object.cc ?? []) as string[];
      const AP_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
      const isPublic = toField.includes(AP_PUBLIC) || ccField.includes(AP_PUBLIC);
      const isPrivateNote = objectType === 'Note' && toField.length > 0 && !isPublic;

      if (isPrivateNote) {
        // Store as inbound DM. Find local recipients by matching their actor URIs.
        const { findOrCreateConversation, sendMessage } = await import('../messaging/messaging.js');
        const { users: usersTable } = await import('@commonpub/schema');

        for (const recipientUri of toField) {
          // Check if this is a local user
          try {
            const recipientUrl = new URL(recipientUri);
            if (recipientUrl.hostname === domain) {
              const recipientUsername = recipientUrl.pathname.split('/').filter(Boolean).pop();
              if (recipientUsername) {
                const [localUser] = await db
                  .select({ id: usersTable.id })
                  .from(usersTable)
                  .where(eq(usersTable.username, recipientUsername))
                  .limit(1);

                if (localUser) {
                  // Store the remote actor as a pseudo-participant using their URI
                  // The conversation system will handle display via the info endpoint
                  try {
                    const conv = await findOrCreateConversation(db, [localUser.id]);
                    const content = typeof object.content === 'string' ? sanitizeHtml(object.content) : '';
                    if (content) {
                      await sendMessage(db, conv.id, localUser.id, `[From ${actorUri}]: ${content}`);
                    }
                  } catch {
                    // Conversation creation may fail — log and continue
                  }
                }
              }
            }
          } catch {
            // Invalid URL — skip
          }
        }

        // Log the activity
        await db.insert(activities).values({
          type: 'Create',
          actorUri,
          objectUri: objectUri ?? null,
          payload: { type: 'Create', actor: actorUri, object },
          direction: 'inbound',
          status: 'processed',
        });
        return;
      }

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
      // Extract sender domain from actorUri for re-broadcast matching
      let senderDomain: string | undefined;
      try { senderDomain = new URL(actorUri).hostname; } catch { /* ignore */ }
      const mirrorId = await matchMirrorForContent(db, originDomain, objectType, cpubType, tags, senderDomain);

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
            // Reply to local content — increment commentCount + notify author
            const parentSlug = parentUrl.pathname.split('/').filter(Boolean).pop();
            if (parentSlug) {
              await db
                .update(contentItems)
                .set({ commentCount: sql`${contentItems.commentCount} + 1` })
                .where(eq(contentItems.slug, parentSlug));

              // Notify content author
              const [parentContent] = await db.select({ authorId: contentItems.authorId, title: contentItems.title })
                .from(contentItems).where(eq(contentItems.slug, parentSlug)).limit(1);
              if (parentContent) {
                const remoteUser = actorUri.split('/').pop() ?? 'Someone';
                await notifyRemoteInteraction(db, parentContent.authorId, 'comment', actorUri,
                  'New reply', `${remoteUser} from the fediverse replied to "${parentContent.title ?? 'your content'}"`,
                  `/content/${parentSlug}`);
              }
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
      // Authorization: only the original author can update their content.
      if (objectUri) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (typeof object.name === 'string') updates.title = object.name;
        if (typeof object.content === 'string') updates.content = sanitizeHtml(object.content);
        if (typeof object.summary === 'string') updates.summary = sanitizeHtml(object.summary);
        if (typeof object.url === 'string') updates.url = object.url;

        const updateResult = await db
          .update(federatedContent)
          .set(updates)
          .where(
            and(
              eq(federatedContent.objectUri, objectUri),
              eq(federatedContent.actorUri, actorUri),
            ),
          )
          .returning({ id: federatedContent.id });

        // If no rows updated, content doesn't exist locally — treat as new content
        // This handles the case where an Update arrives before a Create (e.g., missed during backfill)
        if (updateResult.length === 0) {
          // Delegate to onCreate to store the content
          await handlers.onCreate(actorUri, object);
          return;
        }
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
      // Soft-delete federated content — only the original author can delete
      await db
        .update(federatedContent)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(federatedContent.objectUri, objectId),
            eq(federatedContent.actorUri, actorUri),
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

      // Idempotency: check if we already processed a Like from this actor for this object
      const existing = await db
        .select({ id: activities.id })
        .from(activities)
        .where(
          and(
            eq(activities.type, 'Like'),
            eq(activities.actorUri, actorUri),
            eq(activities.objectUri, objectUri),
            eq(activities.direction, 'inbound'),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Already processed — skip increment, just log
        return;
      }

      // Determine if this Like targets local content or federated content.
      // First check if the objectUri belongs to our domain (local content).
      // Then try slug/UUID match. If neither, it's federated content.
      let matched = false;
      let isLocalUri = false;

      try {
        const parsedUri = new URL(objectUri);
        isLocalUri = parsedUri.hostname === domain;
      } catch {
        // Invalid URI — skip
      }

      if (isLocalUri) {
        // Extract slug or UUID from the URI path
        try {
          const segments = new URL(objectUri).pathname.split('/').filter(Boolean);
          const idOrSlug = segments[segments.length - 1];

          if (idOrSlug) {
            // Try UUID first (more specific)
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (UUID_RE.test(idOrSlug)) {
              const byId = await db.select({ id: contentItems.id }).from(contentItems)
                .where(eq(contentItems.id, idOrSlug)).limit(1);
              if (byId.length > 0) {
                await db.update(contentItems).set({ likeCount: sql`${contentItems.likeCount} + 1` })
                  .where(eq(contentItems.id, byId[0]!.id));
                matched = true;
              }
            }

            // Slug fallback (only for local URIs to prevent cross-domain collision)
            if (!matched) {
              const bySlug = await db.select({ id: contentItems.id }).from(contentItems)
                .where(eq(contentItems.slug, idOrSlug)).limit(1);
              if (bySlug.length > 0) {
                await db.update(contentItems).set({ likeCount: sql`${contentItems.likeCount} + 1` })
                  .where(eq(contentItems.id, bySlug[0]!.id));
                matched = true;

                // Notify content author
                const [likedContent] = await db.select({ authorId: contentItems.authorId, title: contentItems.title })
                  .from(contentItems).where(eq(contentItems.id, bySlug[0]!.id)).limit(1);
                if (likedContent) {
                  const remoteUser = actorUri.split('/').pop() ?? 'Someone';
                  await notifyRemoteInteraction(db, likedContent.authorId, 'like', actorUri,
                    'New like', `${remoteUser} from the fediverse liked "${likedContent.title ?? 'your content'}"`,
                    `/content/${idOrSlug}`);
                }
              }
            }
          }
        } catch { /* invalid URL */ }
      }

      // If not local content, try federated content by exact objectUri
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

  return handlers;
}
