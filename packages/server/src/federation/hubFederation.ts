/**
 * Hub (Group) federation — FEP-1b12 compliant hub federation.
 * Hubs become Group actors that can be followed by remote users.
 * Hub content is federated as Announce activities from the Group actor.
 */
import { eq, and, sql } from 'drizzle-orm';
import {
  hubs,
  hubActorKeypairs,
  hubFollowers,
  hubPosts,
  users,
  activities,
} from '@commonpub/schema';
import {
  generateKeypair,
  exportPublicKeyPem,
  exportPrivateKeyPem,
  buildAnnounceActivity,
  buildAcceptActivity,
  buildDeleteActivity,
  escapeHtmlForAP,
  AP_CONTEXT,
  AP_PUBLIC,
  type APGroup,
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

  // Skip if an outbound Announce for this object from this actor already exists
  const [existing] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.type, 'Announce'),
        eq(activities.actorUri, hubActorUri),
        eq(activities.objectUri, note.id),
        eq(activities.direction, 'outbound'),
      ),
    )
    .limit(1);

  if (!existing) {
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

  const announce = buildAnnounceActivity(domain, hubActorUri, contentObjectUri, followersUri);

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
  post: { id: string; content: string; createdAt: Date },
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

  return note;
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
