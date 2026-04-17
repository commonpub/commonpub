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

// Shared default shape. Exported so feature-gate middleware can use the same
// initializer — if the middleware runs before useFeatures() and initializes
// the 'feature-flags' state to a different value, useFeatures()'s own
// initializer is skipped (Nuxt useState only inits once per key), and any
// `flags.value.X` access would crash at runtime.
export const DEFAULT_FLAGS: FeatureFlags = {
  content: true, social: true, hubs: true, docs: true, video: true,
  contests: false, events: false, learning: true, explainers: true,
  editorial: true, federation: false, admin: false, emailNotifications: false,
};

/** Build the initial flags by merging the layer's runtime config over defaults. */
export function getInitialFlags(): FeatureFlags {
  const config = useRuntimeConfig();
  const buildFlags = (config.public.features as unknown as Partial<FeatureFlags> | undefined) ?? {};
  return { ...DEFAULT_FLAGS, ...buildFlags };
}

export function useFeatures() {
  // Shared reactive state — initialized from build-time config.
  // Uses the shared getInitialFlags() so middleware and composable agree on
  // the default shape (see the DEFAULT_FLAGS export note above).
  const flags = useState<FeatureFlags>('feature-flags', getInitialFlags);

  // Defensive: if another consumer poisoned the state to null/undefined
  // before we ran, repair it here so .value.X accesses don't crash.
  if (flags.value == null) {
    flags.value = getInitialFlags();
  }

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
