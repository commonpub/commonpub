import { fail } from '@sveltejs/kit';
import { getInstanceSettings, setInstanceSetting } from '$lib/server/admin';
import { updateInstanceSettingSchema } from '@snaplify/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const settings = await getInstanceSettings(event.locals.db);

  return {
    settings: Object.fromEntries(settings),
  };
};

export const actions: Actions = {
  update: async ({ request, locals, getClientAddress }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') return fail(403, { error: 'Forbidden' });

    const formData = await request.formData();
    const parsed = updateInstanceSettingSchema.safeParse({
      key: formData.get('key'),
      value: formData.get('value'),
    });

    if (!parsed.success) return fail(400, { error: 'Invalid input' });

    await setInstanceSetting(
      locals.db,
      parsed.data.key as string,
      parsed.data.value,
      locals.user.id,
      getClientAddress(),
    );

    return { success: true };
  },
};
