// Content type composable — reactive access to enabled content types

export type ContentType = 'project' | 'article' | 'blog' | 'explainer';

const CONTENT_TYPE_META: Record<ContentType, { label: string; plural: string; icon: string; route: string }> = {
  project: { label: 'Project', plural: 'Projects', icon: 'fa-solid fa-microchip', route: '/project' },
  article: { label: 'Article', plural: 'Articles', icon: 'fa-solid fa-file-lines', route: '/article' },
  blog: { label: 'Blog', plural: 'Blogs', icon: 'fa-solid fa-pen-nib', route: '/blog' },
  explainer: { label: 'Explainer', plural: 'Explainers', icon: 'fa-solid fa-lightbulb', route: '/explainer' },
};

export function useContentTypes() {
  const config = useRuntimeConfig();

  const enabledTypes = computed<ContentType[]>(() => {
    const raw = config.public.contentTypes as string;
    if (!raw) return ['project', 'article', 'blog', 'explainer'];
    return raw.split(',').map(s => s.trim()).filter(Boolean) as ContentType[];
  });

  const isTypeEnabled = (type: ContentType): boolean => {
    return enabledTypes.value.includes(type);
  };

  const enabledTypeMeta = computed(() => {
    return enabledTypes.value
      .filter(t => t in CONTENT_TYPE_META)
      .map(t => ({ type: t, ...CONTENT_TYPE_META[t] }));
  });

  return {
    enabledTypes,
    isTypeEnabled,
    enabledTypeMeta,
    CONTENT_TYPE_META,
  };
}
