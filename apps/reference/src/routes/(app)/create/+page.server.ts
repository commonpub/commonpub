import { fail, redirect } from '@sveltejs/kit';
import { authGuard } from '@snaplify/auth';
import { createContent } from '$lib/server/content';
import { typeToUrlSegment } from '$lib/utils/content-helpers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const guard = authGuard(event);
  if (!guard.authorized) {
    redirect(guard.status ?? 303, guard.redirectTo ?? '/auth/sign-in');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated' });
    }

    const data = await request.formData();
    const title = data.get('title') as string;
    const type = data.get('type') as string;
    const description = data.get('description') as string | null;
    const contentJson = data.get('content') as string | null;
    const tagsRaw = data.get('tags') as string | null;
    const action = data.get('action') as string;

    if (!title?.trim()) {
      return fail(400, { error: 'Title is required', title, type, description });
    }

    if (!type) {
      return fail(400, { error: 'Content type is required', title, type, description });
    }

    let content: unknown = null;
    if (contentJson) {
      try {
        content = JSON.parse(contentJson);
      } catch {
        return fail(400, { error: 'Invalid content format' });
      }
    }

    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

    const item = await createContent(locals.db, locals.user.id, {
      type,
      title: title.trim(),
      description: description?.trim() || undefined,
      content,
      tags,
    });

    if (action === 'publish') {
      const { publishContent } = await import('$lib/server/content');
      await publishContent(locals.db, item.id, locals.user.id);
    }

    redirect(303, `/${typeToUrlSegment(item.type)}/${item.slug}`);
  },
};
