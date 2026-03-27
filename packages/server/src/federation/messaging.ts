/**
 * Cross-instance direct messaging via ActivityPub.
 * Private messages are AP Create(Note) with to:[recipientActorUri] (no #Public).
 */
import { eq, and } from 'drizzle-orm';
import {
  activities,
  users,
  remoteActors,
} from '@commonpub/schema';
import {
  buildCreateActivity,
  contentToNote,
  resolveActorViaWebFinger,
  sanitizeHtml,
  type ResolvedActor,
} from '@commonpub/protocol';
import type { DB } from '../types.js';

/**
 * Resolve a federated handle (@user@domain) to an actor URI.
 * Returns the actor URI if found, null otherwise.
 */
export async function resolveRemoteHandle(
  db: DB,
  handle: string,
  localDomain: string,
): Promise<{ actorUri: string; inbox: string; displayName: string | null; preferredUsername: string | null } | null> {
  const cleaned = handle.replace(/^@/, '');
  const atIndex = cleaned.indexOf('@');
  if (atIndex === -1) return null;

  const username = cleaned.slice(0, atIndex);
  const domain = cleaned.slice(atIndex + 1);
  if (!username || !domain || domain === localDomain) return null;

  // Check cache first
  const cached = await db
    .select()
    .from(remoteActors)
    .where(
      and(
        eq(remoteActors.preferredUsername, username),
        eq(remoteActors.instanceDomain, domain),
      ),
    )
    .limit(1);

  if (cached.length > 0) {
    return {
      actorUri: cached[0]!.actorUri,
      inbox: cached[0]!.inbox,
      displayName: cached[0]!.displayName,
      preferredUsername: cached[0]!.preferredUsername,
    };
  }

  // WebFinger resolve
  let actor: ResolvedActor | null;
  try {
    actor = await resolveActorViaWebFinger(username, domain, fetch);
  } catch {
    return null;
  }
  if (!actor) return null;

  // Cache the actor
  await db.insert(remoteActors).values({
    actorUri: actor.id,
    inbox: actor.inbox,
    outbox: actor.outbox,
    sharedInbox: actor.endpoints?.sharedInbox,
    publicKeyPem: actor.publicKey?.publicKeyPem,
    preferredUsername: actor.preferredUsername,
    displayName: actor.name,
    summary: actor.summary,
    avatarUrl: actor.icon?.url,
    instanceDomain: domain,
    lastFetchedAt: new Date(),
  }).onConflictDoNothing();

  return {
    actorUri: actor.id,
    inbox: actor.inbox,
    displayName: actor.name ?? null,
    preferredUsername: actor.preferredUsername ?? null,
  };
}

/**
 * Send a federated direct message to a remote actor.
 * Creates a private Create(Note) activity (no #Public in to/cc).
 */
export async function federateDirectMessage(
  db: DB,
  senderUserId: string,
  recipientActorUri: string,
  messageBody: string,
  domain: string,
): Promise<void> {
  const [sender] = await db
    .select()
    .from(users)
    .where(eq(users.id, senderUserId))
    .limit(1);
  if (!sender) return;

  const senderActorUri = `https://${domain}/users/${sender.username}`;

  // Build a private Note (no #Public)
  const noteId = `https://${domain}/messages/${crypto.randomUUID()}`;
  const note = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Note',
    id: noteId,
    attributedTo: senderActorUri,
    to: [recipientActorUri],
    content: sanitizeHtml(messageBody),
    published: new Date().toISOString(),
  };

  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Create',
    id: `https://${domain}/activities/${crypto.randomUUID()}`,
    actor: senderActorUri,
    to: [recipientActorUri],
    object: note,
  };

  // Queue for delivery — the delivery worker will resolve the recipient's inbox
  // and sign the request with the sender's keypair
  await db.insert(activities).values({
    type: 'Create',
    actorUri: senderActorUri,
    objectUri: noteId,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

/**
 * Check if a string looks like a federated handle (@user@domain or user@domain).
 */
export function isFederatedHandle(s: string): boolean {
  const cleaned = s.replace(/^@/, '');
  return cleaned.includes('@') && cleaned.indexOf('@') > 0 && cleaned.indexOf('@') < cleaned.length - 1;
}
