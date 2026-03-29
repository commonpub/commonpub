import { pauseMirror, resumeMirror } from '@commonpub/server';
import { z } from 'zod';

const updateMirrorSchema = z.object({
  action: z.enum(['pause', 'resume']),
});

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const { action } = await parseBody(event, updateMirrorSchema);

  if (action === 'pause') {
    await pauseMirror(db, id);
  } else {
    await resumeMirror(db, id);
  }

  return { success: true };
});
