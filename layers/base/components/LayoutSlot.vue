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

const props = withDefaults(defineProps<{
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
  /**
   * Editor mode flag. When `true`, the row + section wrappers get
   * `--editable` modifier classes which paint a dashed hover outline
   * + a small type-label badge — pure visual affordance. NO event
   * handlers, selection state, or keyboard model land here; those
   * arrive in Phase 3a.3 (editor shell) + 3b (drag-drop) + 3d (a11y
   * keyboard equivalence). Default `false` so public render paths
   * (pages/index.vue, [...customPath].vue) are byte-pattern unchanged.
   *
   * See docs/plans/phase-3-editor.md Phase 3a.1.
   */
  editable?: boolean;
}>(), {
  previewOverride: null,
  editable: false,
});

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

/**
 * Build the props bag to pass to the section's component. Default shape
 * is `{ config, meta }` (the SectionRenderProps contract). Sections
 * registered with a `propMap` use that to adapt the shape — primarily
 * to reuse existing components (Block*View, homepage *Section) without
 * writing parallel Section*.vue renderers.
 *
 * See packages/ui/src/sections.ts:SectionDefinition.propMap.
 */
function resolveSectionProps(section: LayoutSection): Record<string, unknown> {
  const def = sectionRegistry.get(section.type);
  if (!def) return {};
  const standardProps = {
    config: section.config,
    meta: {
      route: props.route,
      zone: props.zone,
      isPreview: !!props.previewOverride,
      effectiveColSpan: resolveColSpan(section, 'lg'),
      sectionId: section.id,
    },
  };
  // propMap is optional — if absent, pass the standard shape through.
  // If present, it takes the standard props and returns the shape the
  // target component expects (e.g., for BlockHeadingView: `{ content: config }`).
  return def.propMap ? def.propMap(standardProps) : standardProps;
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
      :class="{ 'cpub-layout-row--editable': editable }"
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
        :class="{ 'cpub-layout-section--editable': editable }"
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
        <!--
          Section render — props resolved via the registry's optional
          `propMap`. Default (no propMap) → {config, meta}. With propMap,
          the section definition can adapt the standard shape to whatever
          the target component expects (e.g. Block*View takes `content`;
          HomepageHeroSection takes `config: HomepageSectionConfig`).
          See packages/ui/src/sections.ts:SectionDefinition.propMap +
          docs/plans/stage-e-unification.md.
        -->
        <component
          v-if="sectionRegistry.has(section.type)"
          :is="sectionRegistry.get(section.type)!.component"
          v-bind="resolveSectionProps(section)"
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

/* ------------------------------------------------------------------ */
/* Phase 3a.1 — editable-mode chrome.                                  */
/* Pure visual affordance. NO event handlers, no selection state, no  */
/* keyboard model — those arrive in 3a.3 + 3d. The chrome ONLY        */
/* renders when `:editable=true` is passed (admin editor surface);    */
/* public render paths never set the flag, so this CSS is dormant     */
/* on commonpub.io / heatsync / deveco homepages.                     */
/* ------------------------------------------------------------------ */

/* Row chrome — slightly more prominent dashed outline than sections,
   so rows read as containers when an admin hovers between them. */
.cpub-layout-row--editable {
  position: relative;
}
.cpub-layout-row--editable:hover {
  outline: 1px dashed var(--border);
  outline-offset: 2px;
}

/* Section chrome — invisible at rest (per docs/plans/layout-and-pages.md §7.11),
   dashed outline + type-label badge on hover. Uses `outline` (not `border`)
   so grid-column math + min-width:0 stay intact. */
.cpub-layout-section--editable {
  position: relative;
}
.cpub-layout-section--editable:hover {
  outline: 1px dashed var(--border2);
  outline-offset: -1px;
}

/* Type-label badge — top-left corner, only on hover. Reads the
   section's `data-section-type` attribute via attr() so any
   registered section type self-documents without per-type CSS. */
.cpub-layout-section--editable::after {
  content: attr(data-section-type);
  position: absolute;
  top: 0;
  left: 0;
  padding: var(--space-1) var(--space-2);
  background: var(--surface2);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: 1px solid var(--border2);
  border-top: 0;
  border-left: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 100ms ease-out;
  z-index: 1;
}
.cpub-layout-section--editable:hover::after {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-section--editable::after { transition: none; }
}
</style>
