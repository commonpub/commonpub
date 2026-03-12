import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDocsVersion, setDefaultVersion, deleteDocsVersion } from '$lib/server/docs';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let input: { siteId: string; version: string; sourceVersionId?: string; isDefault?: boolean };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const version = await createDocsVersion(locals.db, input.siteId, locals.user.id, input);
    return json(version, { status: 201 });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 403 });
  }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let input: { versionId: string; isDefault?: boolean };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (input.isDefault) {
    const result = await setDefaultVersion(locals.db, input.versionId, locals.user.id);
    if (!result) return json({ error: 'Not found or not authorized' }, { status: 404 });
  }

  return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let input: { versionId: string };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const deleted = await deleteDocsVersion(locals.db, input.versionId, locals.user.id);
  if (!deleted) return json({ error: 'Not found or not authorized' }, { status: 404 });

  return json({ success: true });
};
