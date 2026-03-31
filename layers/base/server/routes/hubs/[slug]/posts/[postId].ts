import { getHubBySlug, getHubActorUri, getHubPostNoteUri } from '@commonpub/server';
import { AP_CONTEXT, AP_PUBLIC, escapeHtmlForAP } from '@commonpub/protocol';
import { hubPosts, users } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

/**
 * Hub post AP Note endpoint.
 * Serves the Note JSON-LD when requested with AP Accept header.
 * Remote instances dereference this URI when processing Announce activities.
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) return;

  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) return;

  const slug = getRouterParam(event, 'slug');
  const postId = getRouterParam(event, 'postId');
  if (!slug || !postId) return;

  const db = useDB();
  const domain = config.instance.domain;

  const hub = await getHubBySlug(db, slug);
  if (!hub) return;

  const [post] = await db
    .select({
      id: hubPosts.id,
      content: hubPosts.content,
      createdAt: hubPosts.createdAt,
      authorUsername: users.username,
    })
    .from(hubPosts)
    .innerJoin(users, eq(hubPosts.authorId, users.id))
    .where(eq(hubPosts.id, postId))
    .limit(1);

  if (!post) return;

  const hubActorUri = getHubActorUri(domain, slug);
  const noteUri = getHubPostNoteUri(domain, slug, postId);
  const actorUri = `https://${domain}/users/${post.authorUsername}`;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: noteUri,
    attributedTo: actorUri,
    content: escapeHtmlForAP(post.content),
    published: post.createdAt.toISOString(),
    to: [AP_PUBLIC],
    cc: [`${hubActorUri}/followers`],
    context: hubActorUri,
  };
});
