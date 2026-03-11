import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserByUsername, getUserContent } from '$lib/server/profile';

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const profile = await getUserByUsername(locals.db, params.username);
  if (!profile) {
    error(404, 'User not found');
  }

  const tab = url.searchParams.get('tab') ?? 'projects';
  const typeMap: Record<string, string> = {
    projects: 'project',
    guides: 'guide',
    explainers: 'explainer',
    articles: 'article',
  };

  const contentType = typeMap[tab];
  const { items } = await getUserContent(locals.db, profile.id, contentType);

  const isOwnProfile = locals.user?.id === profile.id;

  return { profile, items, tab, isOwnProfile };
};
