import { fail } from '@sveltejs/kit';
import { listUsers, updateUserRole, updateUserStatus } from '$lib/server/admin';
import { updateUserRoleSchema, updateUserStatusSchema } from '@snaplify/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const search = event.url.searchParams.get('search') ?? undefined;
  const role = event.url.searchParams.get('role') ?? undefined;
  const status = event.url.searchParams.get('status') ?? undefined;
  const page = parseInt(event.url.searchParams.get('page') ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await listUsers(event.locals.db, {
    search,
    role,
    status,
    limit,
    offset,
  });

  return { users: items, total, page, search, role, status };
};

export const actions: Actions = {
  updateRole: async ({ request, locals, getClientAddress }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') return fail(403, { error: 'Forbidden' });

    const formData = await request.formData();
    const parsed = updateUserRoleSchema.safeParse({
      userId: formData.get('userId'),
      role: formData.get('role'),
    });

    if (!parsed.success) return fail(400, { error: 'Invalid input' });

    await updateUserRole(
      locals.db,
      parsed.data.userId,
      parsed.data.role,
      locals.user.id,
      getClientAddress(),
    );

    return { success: true };
  },

  updateStatus: async ({ request, locals, getClientAddress }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') return fail(403, { error: 'Forbidden' });

    const formData = await request.formData();
    const parsed = updateUserStatusSchema.safeParse({
      userId: formData.get('userId'),
      status: formData.get('status'),
    });

    if (!parsed.success) return fail(400, { error: 'Invalid input' });

    await updateUserStatus(
      locals.db,
      parsed.data.userId,
      parsed.data.status,
      locals.user.id,
      getClientAddress(),
    );

    return { success: true };
  },
};
