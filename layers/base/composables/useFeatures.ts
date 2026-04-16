// Feature flag composable — reactive access to enabled features
// Initializes from build-time runtime config, then hydrates from /api/features
// to pick up runtime DB overrides set via admin panel.

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

let hydrated = false;

const DEFAULT_FLAGS: FeatureFlags = {
  content: true, social: true, hubs: true, docs: true, video: true,
  contests: false, events: false, learning: true, explainers: true,
  editorial: true, federation: false, admin: false, emailNotifications: false,
};

export function useFeatures() {
  const config = useRuntimeConfig();
  const buildFlags = (config.public.features as unknown as FeatureFlags) ?? DEFAULT_FLAGS;

  // Shared reactive state — initialized from build-time config
  const flags = useState<FeatureFlags>('feature-flags', () => ({ ...DEFAULT_FLAGS, ...buildFlags }));

  // On client, fetch dynamic features once to pick up DB overrides
  if (import.meta.client && !hydrated) {
    hydrated = true;
    ($fetch as Function)('/api/features')
      .then((dynamic: FeatureFlags) => {
        if (dynamic && typeof dynamic === 'object') {
          flags.value = { ...flags.value, ...dynamic };
        }
      })
      .catch(() => { /* use build-time defaults on failure */ });
  }

  return {
    features: flags,
    content: computed(() => flags.value.content),
    social: computed(() => flags.value.social),
    hubs: computed(() => flags.value.hubs),
    docs: computed(() => flags.value.docs),
    video: computed(() => flags.value.video),
    contests: computed(() => flags.value.contests),
    events: computed(() => flags.value.events),
    learning: computed(() => flags.value.learning),
    explainers: computed(() => flags.value.explainers),
    editorial: computed(() => flags.value.editorial),
    federation: computed(() => flags.value.federation),
    admin: computed(() => flags.value.admin),
    emailNotifications: computed(() => flags.value.emailNotifications),
  };
}
