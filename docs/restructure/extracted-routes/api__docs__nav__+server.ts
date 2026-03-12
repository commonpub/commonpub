import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateDocsNav } from '$lib/server/docs';
import { docsNavStructureSchema } from '@commonpub/docs';

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let input: { versionId: string; structure: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = docsNavStructureSchema.safeParse(input.structure);
  if (!parsed.success) {
    return json({ error: 'Invalid navigation structure' }, { status: 400 });
  }

  try {
    const nav = await updateDocsNav(locals.db, input.versionId, locals.user.id, parsed.data);
    return json(nav);
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 403 });
  }
};
