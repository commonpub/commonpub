import { fail, redirect } from '@sveltejs/kit';
import { authGuard } from '@snaplify/auth';
import { listContent, deleteContent } from '$lib/server/content';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const guard = authGuard(event);
  if (!guard.authorized) {
    redirect(guard.status ?? 303, guard.redirectTo ?? '/auth/sign-in');
  }

  const tab = (event.url.searchParams.get('tab') ?? 'all') as string;
  const statusFilter = tab === 'all' ? undefined : tab;

  const { items, total } = await listContent(event.locals.db, {
    authorId: event.locals.user!.id,
    status: statusFilter,
  });

  return { items, total, tab };
};

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated' });
    }

    const data = await request.formData();
    const contentId = data.get('contentId') as string;

    if (!contentId) {
      return fail(400, { error: 'Content ID required' });
    }

    const deleted = await deleteContent(locals.db, contentId, locals.user.id);
    if (!deleted) {
      return fail(403, { error: 'Not authorized or content not found' });
    }

    return { success: true };
  },
};
