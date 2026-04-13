// Content type composable — reactive access to enabled content types

export type ContentType = 'project' | 'article' | 'blog' | 'explainer';

const CONTENT_TYPE_META: Record<string, { label: string; plural: string; icon: string; route: string }> = {
  project: { label: 'Project', plural: 'Projects', icon: 'fa-solid fa-microchip', route: '/project' },
  blog: { label: 'Blog', plural: 'Blog', icon: 'fa-solid fa-pen-nib', route: '/blog' },
  explainer: { label: 'Explainer', plural: 'Explainers', icon: 'fa-solid fa-lightbulb', route: '/explainer' },
};

export function useContentTypes() {
  const config = useRuntimeConfig();

  const enabledTypes = computed<ContentType[]>(() => {
    const raw = config.public.contentTypes as string;
    if (!raw) return ['project', 'blog', 'explainer'];
    return raw.split(',').map(s => s.trim()).filter(s => s !== 'article').filter(Boolean) as ContentType[];
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
