/**
 * Hub (Group) federation — FEP-1b12 compliant hub federation.
 * Hubs become Group actors that can be followed by remote users.
 * Hub content is federated as Announce activities from the Group actor.
 */
import { eq, and } from 'drizzle-orm';
import {
  hubs,
  hubActorKeypairs,
  hubFollowers,
  hubPosts,
  users,
  activities,
  contentItems,
} from '@commonpub/schema';
import {
  generateKeypair,
  exportPublicKeyPem,
  exportPrivateKeyPem,
  buildAnnounceActivity,
  buildAcceptActivity,
  buildDeleteActivity,
  buildUpdateActivity,
  buildLikeActivity,
  buildUndoActivity,
  escapeHtmlForAP,
  AP_CONTEXT,
  AP_PUBLIC,
  type APGroup,
  type APLike,
  type APNote,
} from '@commonpub/protocol';
import type { DB } from '../types.js';

// --- Hub Actor Management ---

export function getHubActorUri(domain: string, slug: string): string {
  return `https://${domain}/hubs/${slug}`;
}

/**
 * Get or create a keypair for a hub's Group actor.
 */
export async function getOrCreateHubKeypair(
  db: DB,
  hubId: string,
): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const existing = await db
    .select()
    .from(hubActorKeypairs)
    .where(eq(hubActorKeypairs.hubId, hubId))
    .limit(1);

  if (existing.length > 0) {
    return {
      publicKeyPem: existing[0]!.publicKeyPem,
      privateKeyPem: existing[0]!.privateKeyPem,
    };
  }

  const keypair = await generateKeypair();
  const publicKeyPem = await exportPublicKeyPem(keypair);
  const privateKeyPem = await exportPrivateKeyPem(keypair);

  await db.insert(hubActorKeypairs).values({
    hubId,
    publicKeyPem,
    privateKeyPem,
  });

  return { publicKeyPem, privateKeyPem };
}

/**
 * Build the AP Group actor object for a hub.
 */
export async function buildHubGroupActor(
  db: DB,
  hubSlug: string,
  domain: string,
): Promise<APGroup | null> {
  const [hub] = await db
    .select()
    .from(hubs)
    .where(eq(hubs.slug, hubSlug))
    .limit(1);

  if (!hub) return null;

  const keypair = await getOrCreateHubKeypair(db, hub.id);
  const actorUri = getHubActorUri(domain, hub.slug);

  return {
    '@context': [AP_CONTEXT, 'https://w3id.org/security/v1'],
    type: 'Group',
    id: actorUri,
    preferredUsername: hub.slug,
    name: hub.name,
    summary: hub.description ?? undefined,
    inbox: `${actorUri}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    url: `https://${domain}/hubs/${hub.slug}`,
    icon: hub.iconUrl ? { type: 'Image', url: hub.iconUrl } : undefined,
    image: hub.bannerUrl ? { type: 'Image', url: hub.bannerUrl } : undefined,
    ...(hub.rules ? { 'cpub:rules': hub.rules } : {}),
    ...(hub.categories && (hub.categories as string[]).length > 0 ? { 'cpub:categories': hub.categories } : {}),
    publicKey: {
      id: `${actorUri}#main-key`,
      owner: actorUri,
      publicKeyPem: keypair.publicKeyPem,
    },
  };
}

// --- Hub Follow Management ---

/**
 * Accept a remote follow on a hub. Called from inbox handler when Follow targets a hub actor.
 */
export async function handleHubFollow(
  db: DB,
  hubSlug: string,
  followerActorUri: string,
  activityId: string,
  domain: string,
): Promise<void> {
  const [hub] = await db
    .select()
    .from(hubs)
    .where(eq(hubs.slug, hubSlug))
    .limit(1);

  if (!hub) return;

  // Upsert hub follower
  const existing = await db
    .select()
    .from(hubFollowers)
    .where(
      and(
        eq(hubFollowers.hubId, hub.id),
        eq(hubFollowers.followerActorUri, followerActorUri),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(hubFollowers)
      .set({ status: 'accepted', activityUri: activityId, updatedAt: new Date() })
      .where(eq(hubFollowers.id, existing[0]!.id));
  } else {
    await db.insert(hubFollowers).values({
      hubId: hub.id,
      followerActorUri,
      activityUri: activityId,
      status: hub.privacy === 'public' && hub.joinPolicy === 'open' ? 'accepted' : 'pending',
    });
  }

  // Auto-accept for public open hubs
  if (hub.privacy === 'public' && hub.joinPolicy === 'open') {
    const hubActorUri = getHubActorUri(domain, hub.slug);
    const acceptActivity = buildAcceptActivity(domain, hubActorUri, activityId);
    await db.insert(activities).values({
      type: 'Accept',
      actorUri: hubActorUri,
      objectUri: followerActorUri,
      payload: acceptActivity,
      direction: 'outbound',
      status: 'pending',
    });
  }
}

/**
 * Handle Undo(Follow) for a hub.
 */
export async function handleHubUnfollow(
  db: DB,
  hubSlug: string,
  followerActorUri: string,
  activityUri?: string,
): Promise<void> {
  const [hub] = await db
    .select()
    .from(hubs)
    .where(eq(hubs.slug, hubSlug))
    .limit(1);

  if (!hub) return;

  // Try exact match on activityUri first
  if (activityUri) {
    const byActivity = await db
      .select({ id: hubFollowers.id })
      .from(hubFollowers)
      .where(
        and(
          eq(hubFollowers.hubId, hub.id),
          eq(hubFollowers.followerActorUri, followerActorUri),
          eq(hubFollowers.activityUri, activityUri),
        ),
      )
      .limit(1);

    if (byActivity.length > 0) {
      await db.delete(hubFollowers).where(eq(hubFollowers.id, byActivity[0]!.id));
      return;
    }
  }

  // Fallback: delete the follow for this actor in this hub
  await db.delete(hubFollowers).where(
    and(
      eq(hubFollowers.hubId, hub.id),
      eq(hubFollowers.followerActorUri, followerActorUri),
    ),
  );
}

/**
 * Get accepted followers for a hub.
 */
export async function getHubFederatedFollowers(
  db: DB,
  hubId: string,
): Promise<Array<{ followerActorUri: string }>> {
  return db
    .select({ followerActorUri: hubFollowers.followerActorUri })
    .from(hubFollowers)
    .where(
      and(
        eq(hubFollowers.hubId, hubId),
        eq(hubFollowers.status, 'accepted'),
      ),
    );
}

// --- Hub Content Federation ---

/**
 * Announce a hub's existence to followers and instance mirrors.
 * Sends an Announce from the hub Group actor wrapping its own actor URI.
 * This triggers auto-discovery on receiving instances even when the hub has no posts.
 */
export async function federateHubActor(
  db: DB,
  hubId: string,
  domain: string,
): Promise<void> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (!hub) return;

  const hubActorUri = getHubActorUri(domain, hub.slug);
  const followersUri = `${hubActorUri}/followers`;

  // Announce the hub's own actor URI — triggers auto-discovery on receiving instances
  const announce = buildAnnounceActivity(domain, hubActorUri, hubActorUri, followersUri);

  const [pending] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.type, 'Announce'),
        eq(activities.actorUri, hubActorUri),
        eq(activities.objectUri, hubActorUri),
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'pending'),
      ),
    )
    .limit(1);

  if (!pending) {
    await db.insert(activities).values({
      type: 'Announce',
      actorUri: hubActorUri,
      objectUri: hubActorUri,
      payload: announce,
      direction: 'outbound',
      status: 'pending',
    });
  }
}

/**
 * Federate a hub post as an Announce from the Group actor.
 * Called when content is posted or shared to a hub.
 */
export async function federateHubPost(
  db: DB,
  postId: string,
  hubId: string,
  domain: string,
): Promise<void> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (!hub) return;

  const [post] = await db
    .select({
      post: hubPosts,
      author: { username: users.username, displayName: users.displayName },
    })
    .from(hubPosts)
    .innerJoin(users, eq(hubPosts.authorId, users.id))
    .where(eq(hubPosts.id, postId))
    .limit(1);
  if (!post) return;

  const hubActorUri = getHubActorUri(domain, hub.slug);
  const followersUri = `${hubActorUri}/followers`;

  // Build the post as a Note attributed to the author, with hub-specific URI
  const note = hubPostToNote(post.post, post.author, hub.slug, hubActorUri, domain);

  // The hub Group actor Announces the Note
  const announce = buildAnnounceActivity(domain, hubActorUri, note.id, followersUri);

  // Skip if an outbound Announce for this object is already pending (awaiting delivery).
  // Allow re-creation if previously delivered/failed so refederate works after delivery fixes.
  const [pending] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.type, 'Announce'),
        eq(activities.actorUri, hubActorUri),
        eq(activities.objectUri, note.id),
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'pending'),
      ),
    )
    .limit(1);

  if (!pending) {
    await db.insert(activities).values({
      type: 'Announce',
      actorUri: hubActorUri,
      objectUri: note.id,
      payload: announce,
      direction: 'outbound',
      status: 'pending',
    });
  }
}

/**
 * Federate a content share to a hub as an Announce.
 */
export async function federateHubShare(
  db: DB,
  contentObjectUri: string,
  hubId: string,
  domain: string,
): Promise<void> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (!hub) return;

  const hubActorUri = getHubActorUri(domain, hub.slug);
  const followersUri = `${hubActorUri}/followers`;

  const announce = buildAnnounceActivity(domain, hubActorUri, contentObjectUri, followersUri) as unknown as Record<string, unknown>;

  // Attach cpub:sharedContent metadata so receiving instances can render rich cards
  try {
    const slug = new URL(contentObjectUri).pathname.split('/').filter(Boolean).pop();
    if (slug) {
      const [content] = await db
        .select({
          title: contentItems.title,
          type: contentItems.type,
          description: contentItems.description,
          coverImageUrl: contentItems.coverImageUrl,
          slug: contentItems.slug,
        })
        .from(contentItems)
        .where(eq(contentItems.slug, slug))
        .limit(1);

      if (content) {
        announce['cpub:sharedContent'] = {
          type: content.type,
          title: content.title,
          summary: content.description ?? null,
          coverImageUrl: content.coverImageUrl ?? null,
          originUrl: contentObjectUri,
          originDomain: domain,
        };
      }
    }
  } catch { /* best-effort metadata enrichment */ }

  await db.insert(activities).values({
    type: 'Announce',
    actorUri: hubActorUri,
    objectUri: contentObjectUri,
    payload: announce,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Hub Post Note Builder ---

/** URI for a hub post's AP Note representation */
export function getHubPostNoteUri(domain: string, hubSlug: string, postId: string): string {
  return `https://${domain}/hubs/${hubSlug}/posts/${postId}`;
}

/** Build an AP Note for a hub post with proper hub-scoped URI */
function hubPostToNote(
  post: { id: string; content: string; type: string; createdAt: Date },
  author: { username: string; displayName: string | null },
  hubSlug: string,
  hubActorUri: string,
  domain: string,
): APNote {
  const actorUri = `https://${domain}/users/${author.username}`;
  const objectId = getHubPostNoteUri(domain, hubSlug, post.id);
  const followersUri = `${hubActorUri}/followers`;

  const note: APNote = {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: objectId,
    attributedTo: actorUri,
    content: escapeHtmlForAP(post.content),
    to: [AP_PUBLIC],
    cc: [followersUri],
    published: post.createdAt.toISOString(),
    context: hubActorUri,
  };

  // Preserve post type for CommonPub→CommonPub hub federation
  if (post.type && post.type !== 'text') {
    (note as unknown as Record<string, unknown>)['cpub:postType'] = post.type;
  }

  return note;
}

// --- Post to Remote Hub ---

/**
 * Send a Note from a local user to a remote Group hub's inbox.
 * The remote hub should Announce it to its followers.
 */
export async function sendPostToRemoteHub(
  db: DB,
  userId: string,
  username: string,
  hubActorUri: string,
  content: string,
  domain: string,
  postType: string = 'text',
  inReplyTo?: string,
): Promise<boolean> {
  // Look up the remote hub's inbox
  const { resolveRemoteActor } = await import('./federation.js');
  const actor = await resolveRemoteActor(db, hubActorUri);
  if (!actor?.inbox) return false;

  const localActorUri = `https://${domain}/users/${username}`;
  const noteId = `https://${domain}/users/${username}/posts/${crypto.randomUUID()}`;

  const note: APNote = {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: noteId,
    attributedTo: localActorUri,
    content: escapeHtmlForAP(content),
    to: [hubActorUri],
    cc: [AP_PUBLIC],
    published: new Date().toISOString(),
    context: hubActorUri,
    ...(inReplyTo ? { inReplyTo } : {}),
  };

  // Add cpub:postType extension for CommonPub instances
  if (postType !== 'text') {
    (note as unknown as Record<string, unknown>)['cpub:postType'] = postType;
  }

  // Build a Create activity wrapping the Note
  const createActivity = {
    '@context': AP_CONTEXT,
    type: 'Create',
    id: `${noteId}/activity`,
    actor: localActorUri,
    object: note,
    to: [hubActorUri],
    cc: [AP_PUBLIC],
    published: note.published,
  };

  // Queue for delivery
  await db.insert(activities).values({
    type: 'Create',
    actorUri: localActorUri,
    objectUri: noteId,
    payload: createActivity,
    direction: 'outbound',
    status: 'pending',
  });

  return true;
}

// --- Hub Post Update ---

/**
 * Federate a hub post edit as Update(Note) from the Group actor.
 */
export async function federateHubPostUpdate(
  db: DB,
  postId: string,
  hubId: string,
  domain: string,
): Promise<void> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (!hub) return;

  const [post] = await db
    .select({
      post: hubPosts,
      author: { username: users.username, displayName: users.displayName },
    })
    .from(hubPosts)
    .innerJoin(users, eq(hubPosts.authorId, users.id))
    .where(eq(hubPosts.id, postId))
    .limit(1);
  if (!post) return;

  const hubActorUri = getHubActorUri(domain, hub.slug);
  const note = hubPostToNote(post.post, post.author, hub.slug, hubActorUri, domain);

  const updateActivity = buildUpdateActivity(domain, hubActorUri, note);

  await db.insert(activities).values({
    type: 'Update',
    actorUri: hubActorUri,
    objectUri: note.id,
    payload: updateActivity,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Hub Post Like ---

/**
 * Federate a local user's like on a hub post as a Like activity.
 */
export async function federateHubPostLike(
  db: DB,
  userId: string,
  postId: string,
  hubSlug: string,
  domain: string,
): Promise<void> {
  const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const actorUri = `https://${domain}/users/${user.username}`;
  const objectUri = getHubPostNoteUri(domain, hubSlug, postId);

  const likeActivity = buildLikeActivity(domain, actorUri, objectUri);

  await db.insert(activities).values({
    type: 'Like',
    actorUri,
    objectUri,
    payload: likeActivity,
    direction: 'outbound',
    status: 'pending',
  });
}

/**
 * Federate an Undo(Like) when a local user unlikes a hub post.
 */
export async function federateHubPostUnlike(
  db: DB,
  userId: string,
  postId: string,
  hubSlug: string,
  domain: string,
): Promise<void> {
  const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const actorUri = `https://${domain}/users/${user.username}`;
  const objectUri = getHubPostNoteUri(domain, hubSlug, postId);

  // Find the original Like activity to reference in the Undo
  const [originalLike] = await db.select({ payload: activities.payload })
    .from(activities)
    .where(and(
      eq(activities.type, 'Like'),
      eq(activities.actorUri, actorUri),
      eq(activities.objectUri, objectUri),
      eq(activities.direction, 'outbound'),
    ))
    .limit(1);

  const likeActivity = originalLike?.payload as unknown as APLike | undefined;
  const undoActivity = buildUndoActivity(domain, actorUri, likeActivity ?? buildLikeActivity(domain, actorUri, objectUri));

  await db.insert(activities).values({
    type: 'Undo',
    actorUri,
    objectUri,
    payload: undoActivity,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Hub Post Reply ---

/**
 * Federate a local user's reply to a hub post as Create(Note) with inReplyTo.
 */
export async function federateHubPostReply(
  db: DB,
  userId: string,
  replyContent: string,
  postId: string,
  hubSlug: string,
  domain: string,
): Promise<void> {
  const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const actorUri = `https://${domain}/users/${user.username}`;
  const hubActorUri = getHubActorUri(domain, hubSlug);
  const inReplyTo = getHubPostNoteUri(domain, hubSlug, postId);
  const noteId = `https://${domain}/users/${user.username}/replies/${crypto.randomUUID()}`;
  const followersUri = `${hubActorUri}/followers`;

  // Include original post author in cc so they get notified
  const cc = [followersUri];
  const [post] = await db
    .select({ authorId: hubPosts.authorId })
    .from(hubPosts)
    .where(eq(hubPosts.id, postId))
    .limit(1);
  if (post && post.authorId !== userId) {
    const [postAuthor] = await db.select({ username: users.username }).from(users).where(eq(users.id, post.authorId)).limit(1);
    if (postAuthor) {
      cc.push(`https://${domain}/users/${postAuthor.username}`);
    }
  }

  const note: APNote = {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: noteId,
    attributedTo: actorUri,
    content: escapeHtmlForAP(replyContent),
    inReplyTo,
    to: [AP_PUBLIC],
    cc,
    published: new Date().toISOString(),
    context: hubActorUri,
  };

  const createActivity = {
    '@context': AP_CONTEXT,
    type: 'Create',
    id: `${noteId}/activity`,
    actor: actorUri,
    object: note,
    to: [AP_PUBLIC],
    cc,
    published: note.published,
  };

  await db.insert(activities).values({
    type: 'Create',
    actorUri,
    objectUri: noteId,
    payload: createActivity,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Hub Metadata Update ---

/**
 * Federate a hub metadata update as Update(Group) from the Group actor.
 */
export async function federateHubUpdate(
  db: DB,
  hubId: string,
  domain: string,
): Promise<void> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
  if (!hub) return;

  const actor = await buildHubGroupActor(db, hub.slug, domain);
  if (!actor) return;

  const hubActorUri = getHubActorUri(domain, hub.slug);
  const followersUri = `${hubActorUri}/followers`;

  // Build Update(Group) manually — buildUpdateActivity expects to/cc from the object,
  // but Group actors don't have those fields. Address to public + followers.
  const updateActivity = {
    '@context': AP_CONTEXT,
    type: 'Update',
    id: `https://${domain}/activities/${crypto.randomUUID()}`,
    actor: hubActorUri,
    object: actor,
    to: [AP_PUBLIC],
    cc: [followersUri],
  };

  await db.insert(activities).values({
    type: 'Update',
    actorUri: hubActorUri,
    objectUri: hubActorUri,
    payload: updateActivity,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Hub Post Deletion ---

/**
 * Federate a hub post deletion as Delete(Tombstone) from the Group actor.
 */
export async function federateHubPostDelete(
  db: DB,
  postId: string,
  hubSlug: string,
  domain: string,
): Promise<void> {
  const hubActorUri = getHubActorUri(domain, hubSlug);
  const noteUri = getHubPostNoteUri(domain, hubSlug, postId);

  const deleteActivity = buildDeleteActivity(domain, hubActorUri, noteUri, 'Note');

  await db.insert(activities).values({
    type: 'Delete',
    actorUri: hubActorUri,
    objectUri: noteUri,
    payload: deleteActivity,
    direction: 'outbound',
    status: 'pending',
  });
}
