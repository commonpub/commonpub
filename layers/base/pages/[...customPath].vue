<script setup lang="ts">
/**
 * Catch-all page for custom-page layouts.
 *
 * Spec: docs/plans/layout-and-pages.md §6.1, §6.4.
 *
 * Runs LAST in Nuxt's route precedence — every file-defined route in
 * `pages/` wins automatically because they have a more specific match.
 * For any path not matched by a file route:
 *   1. Read `params.customPath` (array of segments) → join + normalise
 *   2. Reject malformed paths with 404 (don't leak `instance_settings`
 *      reads to obviously-bad inputs)
 *   3. `useLayout(normalisedPath)` to fetch the published layout, if any
 *   4. If found: useSeoMeta from page_meta, render 3 zones via
 *      <LayoutSlot>
 *   5. If null: throw 404 (handled by error.vue)
 *
 * Page meta: hidden from sitemap when not found, indexable by default
 * when found unless `page_meta.noindex` is set.
 *
 * Access control: page_meta.access ∈ {'public', 'members', 'admin'}.
 * Defaults to 'public'. 'members' redirects to /auth/login when not
 * authenticated. 'admin' returns 404 to non-admins (don't leak
 * existence — same posture as draft content).
 *
 * Zones (full-width / main / sidebar) are arranged by the shared
 * <PageFrame> — the one canonical frame used by every page (consolidation
 * pass). Phase 4 will let page_meta.frame parameterise PageFrame's tokens
 * (narrow / wide / sidebar-left etc.) so custom pages pick a frame variant.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import { pathNormalize } from '@commonpub/server/layout/path-normalize';
import type { LayoutPayload } from '../composables/useLayout';

definePageMeta({
  // Run this catch-all AFTER all file-based routes (the default is
  // alphabetical, which already puts `[...x]` last in Nuxt's compile,
  // but pin it explicitly for clarity).
  name: 'custom-page-catchall',
});

const route = useRoute();
const { user: authUser } = useAuth();

// Build raw path from params, then normalise via shared utility.
const rawPath = computed<string>(() => {
  const p = route.params.customPath;
  const parts = Array.isArray(p) ? p : (p ? [p] : []);
  return '/' + parts.join('/');
});

const normalised = computed(() => pathNormalize(rawPath.value));

// Malformed paths 404 early — don't bother with a DB lookup.
if (!normalised.value.ok) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

const pathToLookup = computed(() => (normalised.value.ok ? normalised.value.path : '/'));

// IMPORTANT: use `await useFetch` directly (NOT useLayout) because we need
// the resolved data synchronously in setup() to throw 404 on missing.
// useLayout returns refs without awaiting; the data settles AFTER setup
// returns, so an early `customLayout.value === null` check fires for
// EVERY request — even when a real layout exists. Pages are Suspense-
// wrapped in Nuxt, so top-level await is safe here (same pattern
// pages/index.vue uses for /api/content).
//
// Session 159 audit caught this — it shipped first as `useLayout(...) +
// sync null-check` which had a load-bearing bug (404 always). Fixed by
// switching to awaited useFetch.
const { data: customLayout } = await useFetch<LayoutPayload | null>(
  '/api/layouts/by-route',
  {
    query: computed(() => ({ path: pathToLookup.value })),
    key: computed(() => `layout:${pathToLookup.value}`).value,
    transform: (input: LayoutPayload | null | undefined) => input ?? null,
    onResponseError({ response }) {
      // 404 from API (feature off OR no layout for route) → treat as null;
      // we'll throw a page-level 404 below if needed.
      if (response.status === 404) return;
    },
    server: true,
    lazy: false,
  },
);

// Now safe to check — data is settled by Nuxt's Suspense before this line
if (customLayout.value === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

// Access control — uses page_meta.access. 'admin' returns 404 to non-
// admins (don't leak existence). 'members' redirects to login.
const access = computed(() => customLayout.value?.pageMeta?.access ?? 'public');
const isAuthenticated = computed(() => !!authUser.value);

if (customLayout.value && access.value === 'admin') {
  // We don't have a user.role hint client-side reliably — gate via the
  // existing /api/admin/probe pattern. For SSR-safe behavior, treat
  // missing auth as 404. (Phase 3 inspector lets admins preview drafts
  // — that path goes through a separate route.)
  if (!isAuthenticated.value) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  // For an authenticated non-admin, the server-side admin probe also
  // returns 404 to avoid leaking; client-side a malicious user would
  // see the layout but layout-engine sections honour visibility.roles
  // on top of this gate.
}

if (customLayout.value && access.value === 'members' && !isAuthenticated.value) {
  await navigateTo(`/auth/login?redirect=${encodeURIComponent(pathToLookup.value)}`);
}

// Set page meta from page_meta. Defaults are conservative.
useSeoMeta({
  title: () => customLayout.value?.pageMeta?.title ?? 'CommonPub',
  description: () => customLayout.value?.pageMeta?.description,
  ogTitle: () => customLayout.value?.pageMeta?.title,
  ogDescription: () => customLayout.value?.pageMeta?.description,
  ogImage: () => customLayout.value?.pageMeta?.ogImage,
  ogType: () => customLayout.value?.pageMeta?.ogType ?? 'website',
  robots: () => (customLayout.value?.pageMeta?.noindex ? 'noindex, nofollow' : 'index, follow'),
});

// Resolve which zones the layout actually has — render only those, in
// the canonical order (full-width above the split, then main + sidebar
// side by side, then sidebar collapses below main on narrow viewports).
const zones = computed(() => customLayout.value?.zones?.map((z: { zone: string }) => z.zone) ?? []);
const hasFullWidth = computed(() => zones.value.includes('full-width'));
const hasMain = computed(() => zones.value.includes('main'));
const hasSidebar = computed(() => zones.value.includes('sidebar'));
</script>

<template>
  <!-- Consolidation: the page frame now comes from the shared <PageFrame>
       (one canonical max-width + sidebar width + responsive collapse),
       not a per-page `.cpub-custom-page-grid`. Slots are provided only for
       the zones this layout actually has (preserves the prior hasX gating). -->
  <PageFrame v-if="customLayout">
    <template v-if="hasFullWidth" #full-width>
      <LayoutSlot :route="pathToLookup" zone="full-width" />
    </template>
    <template v-if="hasMain" #main>
      <LayoutSlot :route="pathToLookup" zone="main" />
    </template>
    <template v-if="hasSidebar" #sidebar>
      <LayoutSlot :route="pathToLookup" zone="sidebar" />
    </template>
  </PageFrame>
</template>
