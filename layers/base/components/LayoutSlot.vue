<script setup lang="ts">
/**
 * &lt;LayoutSlot&gt; — renders one zone of a route's active layout.
 *
 * Page (e.g. `pages/index.vue`) is the FRAME; this component is the
 * fillings for each zone the page exposes. Pages declare zones like:
 *
 * ```vue
 * &lt;template&gt;
 *   &lt;LayoutSlot route="/" zone="full-width" /&gt;
 *   &lt;div class="cpub-content-grid"&gt;
 *     &lt;LayoutSlot route="/" zone="main" /&gt;
 *     &lt;aside&gt;&lt;LayoutSlot route="/" zone="sidebar" /&gt;&lt;/aside&gt;
 *   &lt;/div&gt;
 * &lt;/template&gt;
 * ```
 *
 * For each row in the zone:
 *   - Renders a 12-column CSS Grid container with the row's gap setting
 *   - For each enabled + visible section: renders the registered section
 *     component, scoped to its resolved colSpan
 *
 * Visibility filters (run client-side on every render so role/feature
 * changes propagate without a re-fetch):
 *   - section.enabled === false → skipped
 *   - visibility.features intersected with active feature flags must
 *     have ALL flags ON
 *   - visibility.roles must include the current user's role (or
 *     'anonymous' for unauthenticated)
 *
 * When the layout-engine feature is OFF (the default for v1), `useLayout`
 * resolves to null and this component renders nothing — pages that
 * adopt &lt;LayoutSlot&gt; need a v-if fallback to the legacy renderer
 * during the migration window.
 *
 * Section rendering: the registry component map is populated by a Nuxt
 * plugin at startup (Phase 1c). Until then, unknown types render
 * an admin-only error placeholder.
 */
import { computed } from 'vue';
import type { LayoutSection, LayoutPayload, LayoutZoneClient } from '../composables/useLayout';
import { useSectionRegistry } from '../sections/registry';

const props = defineProps<{
  /** Route path this layout is for — e.g. '/', '/blog', '/hubs/foo'. */
  route: string;
  /** Zone slug — must match a zone declared in the layout's storage. */
  zone: string;
  /**
   * Optional override — when set, this layout is rendered INSTEAD of
   * fetching from /api/layouts/by-route. Used by the editor preview
   * pane to render the in-progress draft without a save round-trip.
   */
  previewOverride?: LayoutPayload | null;
}>();

const { layout, pending } = useLayout(props.route);
const features = useFeatures();
const { isAuthenticated, user } = useAuth();
const sectionRegistry = useSectionRegistry();

const activeLayout = computed(() => props.previewOverride ?? layout.value);

const zone = computed<LayoutZoneClient | null>(
  () => activeLayout.value?.zones.find((z: LayoutZoneClient) => z.zone === props.zone) ?? null,
);

function isFeatureOn(featureGate: string | undefined): boolean {
  if (!featureGate) return true;
  return (features.features.value as unknown as Record<string, boolean>)?.[featureGate] ?? false;
}

function currentRole(): string {
  if (!isAuthenticated.value) return 'anonymous';
  return user.value?.role ?? 'member';
}

function sectionVisible(s: LayoutSection): boolean {
  if (!s.enabled) return false;
  const v = s.visibility;
  if (!v) return true;
  if (v.features && v.features.some((f: string) => !isFeatureOn(f))) return false;
  if (v.roles && v.roles.length > 0 && !v.roles.includes(currentRole())) return false;
  // hideAt is a viewport-level filter — applied via CSS, not here
  return true;
}

/**
 * Resolve colSpan honouring the responsive fallback chain. Defers the
 * viewport choice to CSS — we use `--cpub-section-cols-{sm|md|lg}`
 * custom properties on each section and let media queries pick which
 * one becomes the active `grid-column: span N` via `attr()`-style
 * values. For now, just use the base colSpan (12 = full width on mobile
 * happens via the row's flex-wrap).
 */
function resolveColSpan(s: LayoutSection, viewport: 'lg' | 'md' | 'sm'): number {
  if (viewport === 'lg') return s.responsive?.lg ?? s.colSpan;
  if (viewport === 'md') return s.responsive?.md ?? s.responsive?.lg ?? s.colSpan;
  // Mobile default 12 unless explicitly overridden
  return s.responsive?.sm ?? 12;
}
</script>

<template>
  <!--
    Renders nothing when:
      - layout-engine feature is off (useLayout returns null)
      - no layout exists for this route
      - no zone of that slug in the layout
      - zone has zero rows
    All four are valid "absence" cases — fall back to legacy rendering
    via the page's v-if structure.
  -->
  <template v-if="zone && zone.rows.length > 0">
    <div
      v-for="row in zone.rows"
      :key="row.id"
      class="cpub-layout-row"
      :data-row-id="row.id"
      :data-gap="row.config?.gap ?? 'md'"
      :data-align="row.config?.align ?? 'stretch'"
      :data-padding-y="row.config?.paddingY ?? 'none'"
      :style="row.config?.background ? { background: row.config.background } : {}"
    >
      <div
        v-for="section in row.sections.filter(sectionVisible)"
        :key="section.id"
        class="cpub-layout-section"
        :data-section-id="section.id"
        :data-section-type="section.type"
        :data-hide-sm="section.visibility?.hideAt?.includes('sm') ? 'true' : 'false'"
        :data-hide-md="section.visibility?.hideAt?.includes('md') ? 'true' : 'false'"
        :data-hide-lg="section.visibility?.hideAt?.includes('lg') ? 'true' : 'false'"
        :style="{
          '--cpub-section-cols-sm': resolveColSpan(section, 'sm'),
          '--cpub-section-cols-md': resolveColSpan(section, 'md'),
          '--cpub-section-cols-lg': resolveColSpan(section, 'lg'),
        }"
      >
        <!--
          Section render path:
            1. Look up the section's `type` in the registry (one shared
               instance per app process, populated at module-load time in
               sections/registry.ts).
            2. If registered, render via <component :is> with the section's
               `config` + computed `meta`. Vue's component-resolver handles
               both functional + SFC renderers.
            3. If NOT registered, fall back to the admin-only placeholder
               so admins can see "this section type isn't installed" while
               end users see nothing for the section (an unknown section
               shouldn't leak rendering debug info to the public).
        -->
        <component
          v-if="sectionRegistry.has(section.type)"
          :is="sectionRegistry.get(section.type)!.component"
          :config="section.config"
          :meta="{
            route,
            zone,
            isPreview: !!previewOverride,
            effectiveColSpan: resolveColSpan(section, 'lg'),
            sectionId: section.id,
          }"
        />
        <div
          v-else
          class="cpub-layout-section-placeholder"
          :aria-label="`Unregistered section type: ${section.type}`"
        >
          <code>{{ section.type }}</code>
          <span class="cpub-layout-section-placeholder-hint">section type not registered</span>
        </div>
      </div>
    </div>
  </template>

  <!-- Loading shimmer while initial fetch is in flight (no layout payload yet) -->
  <div v-else-if="pending && !previewOverride" class="cpub-layout-skeleton" aria-hidden="true">
    <div class="cpub-layout-skeleton-row" />
    <div class="cpub-layout-skeleton-row" />
  </div>
</template>

<style scoped>
.cpub-layout-row {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-4);
  width: 100%;
}
.cpub-layout-row[data-gap='none'] { gap: 0; }
.cpub-layout-row[data-gap='sm']   { gap: var(--space-2); }
.cpub-layout-row[data-gap='md']   { gap: var(--space-4); }
.cpub-layout-row[data-gap='lg']   { gap: var(--space-6); }

.cpub-layout-row[data-align='center'] { align-items: center; }
.cpub-layout-row[data-align='start']  { align-items: start; }
.cpub-layout-row[data-align='stretch'] { align-items: stretch; }

.cpub-layout-row[data-padding-y='sm'] { padding-block: var(--space-2); }
.cpub-layout-row[data-padding-y='md'] { padding-block: var(--space-4); }
.cpub-layout-row[data-padding-y='lg'] { padding-block: var(--space-6); }
.cpub-layout-row[data-padding-y='xl'] { padding-block: var(--space-8); }

/* Section span: default to lg (desktop). Media queries swap.
   --cpub-section-cols-* are set per-section via inline style. */
.cpub-layout-section {
  grid-column: span var(--cpub-section-cols-lg, 12);
  min-width: 0;
}

@media (max-width: 1024px) {
  .cpub-layout-section { grid-column: span var(--cpub-section-cols-md, var(--cpub-section-cols-lg, 12)); }
}
@media (max-width: 640px) {
  .cpub-layout-section { grid-column: span var(--cpub-section-cols-sm, 12); }
}

/* hideAt — orthogonal to colSpan. Use display:none so layout doesn't reserve space. */
.cpub-layout-section[data-hide-sm='true'] { @media (max-width: 640px) { display: none; } }
.cpub-layout-section[data-hide-md='true'] { @media (min-width: 641px) and (max-width: 1024px) { display: none; } }
.cpub-layout-section[data-hide-lg='true'] { @media (min-width: 1025px) { display: none; } }

/* Placeholder shown when no renderer is registered for the section type */
.cpub-layout-section-placeholder {
  padding: var(--space-4);
  background: var(--surface2);
  border: 1px dashed var(--border2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.cpub-layout-section-placeholder code {
  color: var(--accent);
}
.cpub-layout-section-placeholder-hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

/* Skeleton loading state */
.cpub-layout-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}
.cpub-layout-skeleton-row {
  height: 60px;
  background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
  background-size: 200% 100%;
  animation: cpub-layout-skel 1.4s ease-in-out infinite;
}
@keyframes cpub-layout-skel {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-skeleton-row { animation: none; }
}
</style>
