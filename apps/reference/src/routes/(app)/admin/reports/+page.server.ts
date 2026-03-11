import { fail } from '@sveltejs/kit';
import { listReports, resolveReport } from '$lib/server/admin';
import { resolveReportSchema } from '@snaplify/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const status = event.url.searchParams.get('status') ?? undefined;
  const page = parseInt(event.url.searchParams.get('page') ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await listReports(event.locals.db, { status, limit, offset });

  return { reports: items, total, page, status };
};

export const actions: Actions = {
  resolve: async ({ request, locals, getClientAddress }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') return fail(403, { error: 'Forbidden' });

    const formData = await request.formData();
    const parsed = resolveReportSchema.safeParse({
      reportId: formData.get('reportId'),
      status: formData.get('status'),
      resolution: formData.get('resolution'),
    });

    if (!parsed.success) return fail(400, { error: 'Invalid input' });

    await resolveReport(
      locals.db,
      parsed.data.reportId,
      parsed.data.resolution,
      parsed.data.status,
      locals.user.id,
      getClientAddress(),
    );

    return { success: true };
  },
};
