import { fail } from '@sveltejs/kit';
import { getInstanceSetting, setInstanceSetting } from '$lib/server/admin';
import { isValidThemeId } from '@snaplify/ui';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const defaultTheme = await getInstanceSetting(event.locals.db, 'theme.default');
  const tokenOverrides = await getInstanceSetting(event.locals.db, 'theme.token_overrides');

  return {
    defaultTheme: typeof defaultTheme === 'string' ? defaultTheme : 'base',
    tokenOverrides:
      typeof tokenOverrides === 'object' && tokenOverrides !== null
        ? (tokenOverrides as Record<string, string>)
        : {},
  };
};

export const actions: Actions = {
  setTheme: async ({ request, locals, getClientAddress }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') return fail(403, { error: 'Forbidden' });

    const formData = await request.formData();
    const themeId = formData.get('themeId') as string;

    if (!isValidThemeId(themeId)) return fail(400, { error: 'Invalid theme' });

    await setInstanceSetting(
      locals.db,
      'theme.default',
      themeId,
      locals.user.id,
      getClientAddress(),
    );

    return { success: true };
  },

  setTokenOverrides: async ({ request, locals, getClientAddress }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') return fail(403, { error: 'Forbidden' });

    const formData = await request.formData();
    const overridesJson = formData.get('overrides') as string;

    let overrides: Record<string, string>;
    try {
      overrides = JSON.parse(overridesJson);
    } catch {
      return fail(400, { error: 'Invalid JSON' });
    }

    await setInstanceSetting(
      locals.db,
      'theme.token_overrides',
      overrides,
      locals.user.id,
      getClientAddress(),
    );

    return { success: true };
  },
};
