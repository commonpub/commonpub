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
      type: hubPosts.type,
      createdAt: hubPosts.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
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

  // Build Note content — share posts need special handling
  let noteContent = escapeHtmlForAP(post.content);
  const ext: Record<string, unknown> = {};

  if (post.type === 'share') {
    try {
      const shared = JSON.parse(post.content) as Record<string, unknown>;
      ext['cpub:sharedContent'] = {
        type: shared.type ?? 'article',
        title: shared.title ?? '',
        summary: shared.description ?? null,
        coverImageUrl: shared.coverImageUrl ?? null,
        originUrl: shared.slug
          ? `https://${domain}/${shared.type}/${shared.slug}`
          : null,
        originDomain: domain,
      };
      const displayName = post.authorDisplayName ?? post.authorUsername;
      const title = shared.title ? String(shared.title) : 'content';
      noteContent = escapeHtmlForAP(`${displayName} shared: ${title}`);
    } catch { /* fallback to raw content */ }
  }

  if (post.type && post.type !== 'text') {
    ext['cpub:postType'] = post.type;
  }

  return {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: noteUri,
    attributedTo: actorUri,
    content: noteContent,
    published: post.createdAt.toISOString(),
    to: [AP_PUBLIC],
    cc: [`${hubActorUri}/followers`],
    context: hubActorUri,
    ...ext,
  };
});
