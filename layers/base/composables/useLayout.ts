/**
 * Client-side composable for resolving a route's active layout.
 *
 * Wraps `useFetch('/api/layouts/by-route?path=…')` with SSR-safe caching:
 *   - Server-side: fetched during SSR, payload is included in the
 *     hydration snapshot (Nuxt's `useFetch` default) — same data is
 *     re-used on client mount with zero extra requests
 *   - Client-side: subsequent navigations to the same path return the
 *     cached value (Nuxt's request cache, keyed by `key`)
 *
 * Returns `null` when:
 *   - The layout-engine feature is OFF (`/api/layouts/by-route` 404s,
 *     which we surface as null so consumers fall back to legacy renderers
 *     gracefully)
 *   - No layout exists for the route
 *
 * The `<LayoutSlot>` component is the only intended caller in v1; other
 * consumers should use that instead.
 */
import { computed } from 'vue';
import type { Ref } from 'vue';

export interface LayoutSection {
  id: string;
  order: number;
  type: string;
  config: Record<string, unknown>;
  colSpan: number;
  responsive: { sm?: number; md?: number; lg?: number } | null;
  enabled: boolean;
  visibility: { roles?: string[]; features?: string[]; hideAt?: ('sm' | 'md' | 'lg')[] } | null;
  schemaVersion: number;
}

export interface LayoutRow {
  id: string;
  order: number;
  config: {
    gap?: 'none' | 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'stretch';
    background?: string;
    paddingY?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  } | null;
  sections: LayoutSection[];
}

export interface LayoutZoneClient {
  zone: string;
  rows: LayoutRow[];
}

export interface LayoutPayload {
  zones: LayoutZoneClient[];
  pageMeta: {
    title: string;
    description?: string;
    ogImage?: string;
    noindex?: boolean;
    ogType?: 'website' | 'article' | 'profile';
    access?: 'public' | 'members' | 'admin';
    frame?: 'narrow' | 'wide' | 'two-column' | 'three-column' | 'sidebar-left' | 'sidebar-right';
  } | null;
  state: 'draft' | 'published';
}

export interface UseLayoutResult {
  /** The layout payload, or null if none exists / feature off. */
  layout: Ref<LayoutPayload | null>;
  /** True while the initial fetch is in flight. */
  pending: Ref<boolean>;
  /** Truthy if the fetch errored (incl. 404 for feature off). */
  error: Ref<unknown>;
  /** Re-fetch the layout (after a save / publish). */
  refresh: () => Promise<void>;
}

/**
 * Resolve the layout for a given route path. SSR-safe; caches per path
 * for the request lifetime + survives hydration.
 *
 * Returns a layout=null Ref when the feature is off so consumers can
 * `v-if="layout"` and fall through to a legacy renderer.
 *
 * **Reactivity**: pass a string for the typical case (literal route on
 * a page) — useFetch fires once at setup. For the rare case where the
 * route changes without remount (e.g. a parent component swapping the
 * prop dynamically), pass a Ref or getter — useFetch will refire on
 * change. Without this, a path-prop change on `<LayoutSlot>` would
 * silently leave the stale fetch result in place.
 */
export function useLayout(path: string | Ref<string> | (() => string)): UseLayoutResult {
  const pathGetter = (): string => (
    typeof path === 'string'
      ? path
      : typeof path === 'function'
        ? path()
        : path.value
  );

  // Resolve query as a reactive computed — passing `{ path: pathGetter }`
  // (a raw function value) made useFetch serialise the function reference,
  // turning the request URL into ?path=undefined → 400 → null layout. The
  // bug was load-bearing for the canary on commonpub.io (session 159): SSR
  // saw `homepageLayout.value === null` despite a published layout existing,
  // so layoutEngineActive resolved to false and pages/index.vue fell
  // through to the legacy renderer. Fix: always pass a Ref/computed so
  // useFetch reads the resolved value AND re-evaluates on dep change.
  const queryRef = computed(() => ({ path: pathGetter() }));

  const { data, pending, error, refresh } = useFetch<LayoutPayload | null>(
    '/api/layouts/by-route',
    {
      // Static key for the literal-string case (so Nuxt's request cache
      // can dedupe across components on the same nav). For the reactive
      // case, omit key so useFetch derives one from the query Ref.
      key: typeof path === 'string' ? `layout:${path}` : undefined,
      query: queryRef,
      // Watch the path getter so reactive callers refetch on change.
      // For string callers this is empty array → no extra reactivity.
      watch: typeof path === 'string' ? [] : [pathGetter],
      // 404 from the API (feature off OR route has no layout) is NOT an
      // exceptional case — surface as null. Don't treat as error.
      onResponseError({ response }) {
        if (response.status === 404) {
          // Don't throw; data stays null
          return;
        }
      },
      // Falsy data on 404 maps to null
      transform: (input: LayoutPayload | null | undefined) => input ?? null,
      server: true,
      lazy: false,
    },
  );

  return {
    layout: data as Ref<LayoutPayload | null>,
    pending,
    error,
    refresh: async () => { await refresh(); },
  };
}
