import { shareContent, getHubBySlug, getFederatedContent, createPost, federateHubShare, resolveContentObjectUri } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { z } from 'zod';

const shareContentSchema = z.object({
  contentId: z.string().uuid().optional(),
  federatedContentId: z.string().uuid().optional(),
}).refine((d) => d.contentId || d.federatedContentId, { message: 'Either contentId or federatedContentId is required' });

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, shareContentSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  // Share local content
  if (input.contentId) {
    const post = await shareContent(db, user.id, hub.id, input.contentId);
    if (!post) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot share. You must be a hub member and the content must exist.' });
    }

    // Federate the shared content as Announce from the hub Group actor
    if (config.features.federation && config.features.federateHubs) {
      resolveContentObjectUri(db, input.contentId, config.instance.domain).then((contentUri) => {
        if (contentUri) {
          return federateHubShare(db, contentUri, hub.id, config.instance.domain);
        }
      }).catch((err) => {
        console.error('[hub-federation] Failed to federate share:', err);
      });
    }

    return post;
  }

  // Share federated content
  const fedContent = await getFederatedContent(db, input.federatedContentId!);
  if (!fedContent) {
    throw createError({ statusCode: 404, statusMessage: 'Federated content not found' });
  }

  const sharePayload = JSON.stringify({
    federatedContentId: fedContent.id,
    title: fedContent.title,
    type: fedContent.cpubType ?? fedContent.apType ?? 'blog',
    coverImageUrl: fedContent.coverImageUrl ?? null,
    description: fedContent.summary ?? null,
    originUrl: fedContent.url ?? fedContent.objectUri,
    originDomain: fedContent.originDomain,
  });

  let post;
  try {
    post = await createPost(db, user.id, {
      hubId: hub.id,
      type: 'share',
      content: sharePayload,
    });
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'You must be a hub member to share content' });
  }

  // Federate the share using the object URI of the federated content
  if (config.features.federation && config.features.federateHubs) {
    federateHubShare(db, fedContent.objectUri, hub.id, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate share:', err);
    });
  }

  return post;
});
