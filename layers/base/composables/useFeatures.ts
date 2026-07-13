// Feature flag composable — reactive access to enabled features
// Initializes from build-time runtime config, then hydrates from /api/features
// to pick up runtime DB overrides set via admin panel.

export interface IdentityFeatures {
  linkRemoteAccounts: boolean;
  signInWithRemote: boolean;
  actingAs: boolean;
  remoteInteract: boolean;
  remotePublish: boolean;
}

export interface FeatureFlags {
  content: boolean;
  social: boolean;
  hubs: boolean;
  docs: boolean;
  video: boolean;
  contests: boolean;
  /** Per-stage submission artifacts for multi-round contests. Default ON;
   *  inert until a stage defines a submissionTemplate. */
  contestStageSubmissions: boolean;
  /** Form-first proposal submissions + draft placeholder project (Phase 4). Default OFF. */
  contestProposals: boolean;
  /** Offer PII field types in the submission-form builder (Phase 4). Default OFF.
   *  PII access is always gated server-side by `contest.pii.read`. */
  contestPii: boolean;
  /** Automatic contest deadline reminder emails to registered participants.
   *  Default OFF; inert unless emailNotifications is also on. */
  contestReminders: boolean;
  /** Per-contest email-template editor: customize confirmation + reminder copy.
   *  Default OFF; also gates send-side application of a stored override. */
  contestEmailEditor: boolean;
  events: boolean;
  learning: boolean;
  explainers: boolean;
  editorial: boolean;
  federation: boolean;
  admin: boolean;
  /** Guided theme generator (theme-studio) in the admin theme builder. Default ON. */
  themeStudio: boolean;
  emailNotifications: boolean;
  publicApi: boolean;
  contentImport: boolean;
  /**
   * DB-backed page layout engine. Default OFF — when ON, the homepage
   * (and future layout-bearing pages) render via `<LayoutSlot>` zones
   * resolved from the `layouts` table. Operator MUST run
   * POST /api/admin/layouts/seed-homepage before flipping this on so
   * a default layout exists at scope ('route', '/'). Added session 158.
   */
  layoutEngine: boolean;
  /**
   * Global RBAC (session 175). Client-advisory only — drives `useCan`'s
   * button-hiding; the server resolver is the enforcement boundary. Default
   * OFF. See docs/plans/rbac.md.
   */
  rbac: boolean;
  /** Act as an instance registry/directory (Phase 4). Default OFF. */
  actAsRegistry: boolean;
  /** Announce this instance to a registry (Phase 4). Default ON (discoverable). */
  announceToRegistry: boolean;
  /** Expose federation reach metrics on the public API. Default OFF (server-gated). */
  publicApiMetricsFederation: boolean;
  /** User-owned referral links (signup attribution + onboarding actions). Default OFF. */
  referralLinks: boolean;
  /** Feature one hub as a full-width hero atop the hubs listing. Default OFF. */
  featuredHub: boolean;
  /** Hub governance: transfer ownership, Steward role + flag queue, self-unlink. Default OFF. */
  hubGovernance: boolean;
  /**
   * Cross-instance delegated authorization. All sub-flags default false.
   * Mirrors `@commonpub/config`'s `IdentityFeatures`. Phase 1b+ — see
   * docs/sessions/136-cross-instance-identity-plan.md.
   */
  identity: IdentityFeatures;
}

let hydrated = false;

// Shared default shape. Exported so feature-gate middleware can use the same
// initializer — if the middleware runs before useFeatures() and initializes
// the 'feature-flags' state to a different value, useFeatures()'s own
// initializer is skipped (Nuxt useState only inits once per key), and any
// `flags.value.X` access would crash at runtime.
export const DEFAULT_FLAGS: FeatureFlags = {
  content: true, social: true, hubs: true, docs: true, video: true,
  contests: false, contestStageSubmissions: true, contestProposals: false, contestPii: false,
  contestReminders: false, contestEmailEditor: false,
  events: false, learning: true, explainers: true,
  editorial: true, federation: false, admin: false, themeStudio: true, emailNotifications: false,
  publicApi: false, contentImport: true,
  layoutEngine: false,
  rbac: false,
  actAsRegistry: false,
  announceToRegistry: true,
  publicApiMetricsFederation: false,
  referralLinks: false,
  featuredHub: false,
  hubGovernance: false,
  identity: {
    linkRemoteAccounts: false,
    signInWithRemote: false,
    actingAs: false,
    remoteInteract: false,
    remotePublish: false,
  },
};

/**
 * Build the initial flags. Two sources, in priority order:
 *
 *   1. **Server-side, request-scoped**: `event.context.cpubFeatureFlags` —
 *      DB-merged values set by the Nitro `feature-flags-prime` plugin
 *      (apps/reference/server/plugins/feature-flags-prime.ts). This is
 *      how admin-UI flag overrides take effect at SSR time. Without it,
 *      SSR would render with stale build-time defaults until client
 *      hydration replaced them — visible flash + broken curl-based canary.
 *
 *   2. **Build-time runtime config**: `useRuntimeConfig().public.features` —
 *      the legacy initialisation. Fallback for client-side, for early
 *      startup before the plugin's hook can fire, and for thin apps
 *      that haven't installed the prime plugin yet.
 *
 * Either way, defaults fill any unmentioned flags + identity is deep-
 * merged so a partial override (e.g. `{ identity: { actingAs: true } }`)
 * lands on top of the defaulted sub-flags rather than replacing the
 * whole nested object.
 */
export function getInitialFlags(): FeatureFlags {
  if (import.meta.server) {
    // useRequestEvent is auto-imported on Nuxt server-side
    const event = (typeof useRequestEvent === 'function') ? useRequestEvent() : null;
    const ctxFlags = event?.context?.cpubFeatureFlags as Partial<FeatureFlags> | undefined;
    if (ctxFlags && typeof ctxFlags === 'object') {
      return {
        ...DEFAULT_FLAGS,
        ...ctxFlags,
        identity: { ...DEFAULT_FLAGS.identity, ...(ctxFlags.identity ?? {}) },
      };
    }
  }
  const config = useRuntimeConfig();
  const buildFlags = (config.public.features as unknown as Partial<FeatureFlags> | undefined) ?? {};
  return {
    ...DEFAULT_FLAGS,
    ...buildFlags,
    identity: { ...DEFAULT_FLAGS.identity, ...(buildFlags.identity ?? {}) },
  };
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
      .then((dynamic: Partial<FeatureFlags>) => {
        if (dynamic && typeof dynamic === 'object') {
          // Deep-merge `identity` so a server response that omits some
          // sub-flag doesn't blank it out at the client.
          flags.value = {
            ...flags.value,
            ...dynamic,
            identity: {
              ...flags.value.identity,
              ...(dynamic.identity ?? {}),
            },
          };
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
    contestStageSubmissions: computed(() => flags.value.contestStageSubmissions),
    contestProposals: computed(() => flags.value.contestProposals),
    contestPii: computed(() => flags.value.contestPii),
    contestReminders: computed(() => flags.value.contestReminders),
    contestEmailEditor: computed(() => flags.value.contestEmailEditor),
    events: computed(() => flags.value.events),
    learning: computed(() => flags.value.learning),
    explainers: computed(() => flags.value.explainers),
    editorial: computed(() => flags.value.editorial),
    federation: computed(() => flags.value.federation),
    admin: computed(() => flags.value.admin),
    themeStudio: computed(() => flags.value.themeStudio),
    emailNotifications: computed(() => flags.value.emailNotifications),
    publicApi: computed(() => flags.value.publicApi),
    contentImport: computed(() => flags.value.contentImport),
    layoutEngine: computed(() => flags.value.layoutEngine),
    rbac: computed(() => flags.value.rbac),
    referralLinks: computed(() => flags.value.referralLinks),
    featuredHub: computed(() => flags.value.featuredHub),
    hubGovernance: computed(() => flags.value.hubGovernance),
    identity: computed(() => flags.value.identity),
  };
}
