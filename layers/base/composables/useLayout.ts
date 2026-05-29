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
import type {
  LayoutRecord,
  LayoutSectionResolved,
  LayoutRowResolved,
  LayoutZone,
} from '@commonpub/server';

// Re-export the server-side resolved types under the existing client-
// facing names. Until session 162 these were locally-declared duplicates
// (manually kept in sync) — the R2 audit caught that AdminLayoutsCanvas
// hand-mapped LayoutRecord → LayoutPayload field-by-field, silently
// dropping any newly-added section field (e.g. a future `pinned` flag).
// Same-named single source of truth fixes that bug class.
export type LayoutSection = LayoutSectionResolved;
export type LayoutRow = LayoutRowResolved;
export type LayoutZoneClient = LayoutZone;

/**
 * The leaner client-facing view of a layout — only the fields the
 * renderer needs (state for draft-gate, pageMeta for SEO, zones for
 * structure). Structurally a `Pick` of the full server LayoutRecord
 * so any LayoutRecord is assignable to LayoutPayload without
 * transformation (session 162 P2.4 R2 audit fix).
 *
 * IMPORTANT CAVEAT — because the row/section types are re-exports of
 * the server's resolved types (above), any new field added to
 * LayoutSectionResolved or LayoutRowResolved on the server will
 * automatically flow through to the public render path here. That's
 * usually what you want for genuinely public fields (e.g. a future
 * `pinned: boolean` should be visible). But fields that should be
 * admin-only (e.g. internal moderation tags) MUST be added to a
 * separate server-side type, never to LayoutSectionResolved /
 * LayoutRowResolved — otherwise they leak via /api/layouts/by-route.
 * Session 162 audit note.
 */
export type LayoutPayload = Pick<LayoutRecord, 'state' | 'pageMeta' | 'zones'>;

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
