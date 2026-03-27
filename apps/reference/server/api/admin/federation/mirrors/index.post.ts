import { createMirror } from '@commonpub/server';
import { z } from 'zod';

const createMirrorSchema = z.object({
  remoteDomain: z.string().min(3).max(255),
  remoteActorUri: z.string().url(),
  direction: z.enum(['pull', 'push']),
  filterContentTypes: z.array(z.string()).nullable().optional(),
  filterTags: z.array(z.string()).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireAdmin(event);
  const db = useDB();
  const input = await parseBody(event, createMirrorSchema);

  const config = useConfig();
  return createMirror(
    db,
    input.remoteDomain,
    input.remoteActorUri,
    input.direction,
    config.instance.domain,
    {
      contentTypes: input.filterContentTypes ?? undefined,
      tags: input.filterTags ?? undefined,
    },
  );
});
