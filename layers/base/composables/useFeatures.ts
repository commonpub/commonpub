// Feature flag composable — reactive access to enabled features

export interface FeatureFlags {
  content: boolean;
  social: boolean;
  hubs: boolean;
  docs: boolean;
  video: boolean;
  contests: boolean;
  learning: boolean;
  explainers: boolean;
  federation: boolean;
  admin: boolean;
}

export function useFeatures() {
  const config = useRuntimeConfig();
  const flags = config.public.features as FeatureFlags;

  return {
    features: flags,
    content: computed(() => flags.content),
    social: computed(() => flags.social),
    hubs: computed(() => flags.hubs),
    docs: computed(() => flags.docs),
    video: computed(() => flags.video),
    contests: computed(() => flags.contests),
    learning: computed(() => flags.learning),
    explainers: computed(() => flags.explainers),
    federation: computed(() => flags.federation),
    admin: computed(() => flags.admin),
  };
}
