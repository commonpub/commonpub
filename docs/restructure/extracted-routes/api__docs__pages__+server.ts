import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDocsPage, updateDocsPage, deleteDocsPage } from '$lib/server/docs';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let input: {
    versionId: string;
    title: string;
    slug?: string;
    content: string;
    sortOrder?: number;
    parentId?: string;
  };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const page = await createDocsPage(locals.db, locals.user.id, input);
    return json(page, { status: 201 });
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

  let input: {
    pageId: string;
    title?: string;
    slug?: string;
    content?: string;
    sortOrder?: number;
    parentId?: string | null;
  };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { pageId, ...updates } = input;
  if (!pageId) {
    return json({ error: 'pageId is required' }, { status: 400 });
  }

  const updated = await updateDocsPage(locals.db, pageId, locals.user.id, updates);
  if (!updated) {
    return json({ error: 'Not found or not authorized' }, { status: 404 });
  }

  return json(updated);
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.docs) {
    return json({ error: 'Documentation system is not enabled' }, { status: 404 });
  }
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let input: { pageId: string };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const deleted = await deleteDocsPage(locals.db, input.pageId, locals.user.id);
  if (!deleted) {
    return json({ error: 'Not found or not authorized' }, { status: 404 });
  }

  return json({ success: true });
};
