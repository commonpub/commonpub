// Feature flag composable — reactive access to enabled features

export interface FeatureFlags {
  content: boolean;
  social: boolean;
  hubs: boolean;
  docs: boolean;
  video: boolean;
  contests: boolean;
  events: boolean;
  learning: boolean;
  explainers: boolean;
  editorial: boolean;
  federation: boolean;
  admin: boolean;
  emailNotifications: boolean;
}

export function useFeatures() {
  const config = useRuntimeConfig();
  const flags = config.public.features as unknown as FeatureFlags;

  return {
    features: flags,
    content: computed(() => flags.content),
    social: computed(() => flags.social),
    hubs: computed(() => flags.hubs),
    docs: computed(() => flags.docs),
    video: computed(() => flags.video),
    contests: computed(() => flags.contests),
    events: computed(() => flags.events),
    learning: computed(() => flags.learning),
    explainers: computed(() => flags.explainers),
    editorial: computed(() => flags.editorial),
    federation: computed(() => flags.federation),
    admin: computed(() => flags.admin),
    emailNotifications: computed(() => flags.emailNotifications),
  };
}
