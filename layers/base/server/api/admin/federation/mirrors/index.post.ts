import { createMirror, requestMirror } from '@commonpub/server';
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
  requirePermission(event, 'federation.manage');
  const db = useDB();
  const input = await parseBody(event, createMirrorSchema);
  const config = useConfig();

  // Push = consent-based mirror request (Phase 3): ask them to pull-mirror us. No filters here —
  // the approver chooses their own depth/filters. Pull = a normal subscription to their content.
  if (input.direction === 'push') {
    return requestMirror(db, input.remoteDomain, input.remoteActorUri, config.instance.domain);
  }

  return createMirror(
    db,
    input.remoteDomain,
    input.remoteActorUri,
    'pull',
    config.instance.domain,
    {
      contentTypes: input.filterContentTypes ?? undefined,
      tags: input.filterTags ?? undefined,
    },
  );
});
