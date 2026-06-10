<script setup lang="ts">
import type { NavItem } from '@commonpub/server';
import { computeVisibleCount, buildMoreItem } from '../../utils/navOverflow';

const props = defineProps<{
  items: NavItem[];
  openDropdown: string | null;
}>();

const emit = defineEmits<{
  'toggle-dropdown': [name: string];
  'close-dropdowns': [];
}>();

const { isAuthenticated, isAdmin } = useAuth();
const features = useFeatures();

const featureMap = computed(() => {
  const map: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(features)) {
    if (typeof val === 'object' && val !== null && 'value' in val) {
      map[key] = (val as { value: boolean }).value;
    }
  }
  return map;
});

function isVisible(item: NavItem): boolean {
  if (item.featureGate && !featureMap.value[item.featureGate]) return false;
  if (item.visibleTo === 'authenticated' && !isAuthenticated.value) return false;
  if (item.visibleTo === 'admin' && !isAdmin.value) return false;
  return true;
}

const shownItems = computed(() => props.items.filter(isVisible));

// --- Priority nav (overflow → "More" dropdown) --------------------------
// The bar used to push the search box and Log in/avatar off-screen whenever
// the links outgrew the viewport (any width between the 768px hamburger
// cutover and ~1100px, worse with extra links or wide-link themes). A hidden
// duplicate row renders EVERY item so their widths are measurable even when
// collapsed; computeVisibleCount decides the split. SSR renders everything
// (no measurement) and the client corrects after hydration.
const containerEl = ref<HTMLElement | null>(null);
const measureEl = ref<HTMLElement | null>(null);
const moreMeasureEl = ref<HTMLElement | null>(null);
const visibleCount = ref(Number.POSITIVE_INFINITY);

const displayItems = computed(() => shownItems.value.slice(0, visibleCount.value));
const moreItem = computed(() => buildMoreItem(shownItems.value.slice(displayItems.value.length)));

function measure(): void {
  const container = containerEl.value;
  const row = measureEl.value;
  if (!container || !row) return;
  const widths = Array.from(row.children).map((el) => (el as HTMLElement).offsetWidth);
  const moreWidth = moreMeasureEl.value?.offsetWidth ?? 90;
  visibleCount.value = computeVisibleCount(widths, container.clientWidth, moreWidth);
}

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && containerEl.value) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(containerEl.value);
  }
  // Web fonts widen the ITEMS without resizing the container, so the
  // ResizeObserver alone misses the post-FOUT width change.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => measure()).catch(() => {});
  }
});
onUnmounted(() => resizeObserver?.disconnect());
watch(shownItems, () => nextTick(measure));
</script>

<template>
  <nav ref="containerEl" class="cpub-topbar-nav" aria-label="Main navigation">
    <template v-for="item in displayItems" :key="item.id">
      <NavDropdown
        v-if="item.type === 'dropdown'"
        :item="item"
        :open="openDropdown === item.id"
        @toggle="emit('toggle-dropdown', item.id)"
        @close="emit('close-dropdowns')"
      />
      <NavLink
        v-else
        :item="item"
      />
    </template>

    <NavDropdown
      v-if="moreItem"
      :item="moreItem"
      :open="openDropdown === '__more'"
      @toggle="emit('toggle-dropdown', '__more')"
      @close="emit('close-dropdowns')"
    />

    <!-- Hidden measurement row: every item at natural width + a More trigger
         replica. visibility:hidden keeps it out of the a11y tree and tab
         order; the layout owner styles .cpub-nav-measure to zero height. -->
    <div ref="measureEl" class="cpub-nav-measure" aria-hidden="true">
      <template v-for="item in shownItems" :key="`m-${item.id}`">
        <span v-if="item.type === 'dropdown'" class="cpub-nav-link cpub-nav-trigger">
          <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
          <i class="fa-solid fa-chevron-down cpub-nav-caret" />
        </span>
        <span v-else class="cpub-nav-link">
          <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
        </span>
      </template>
    </div>
    <div ref="moreMeasureEl" class="cpub-nav-measure" aria-hidden="true">
      <span class="cpub-nav-link cpub-nav-trigger">
        More <i class="fa-solid fa-chevron-down cpub-nav-caret" />
      </span>
    </div>
  </nav>
</template>

<style scoped>
/* Measurement rows are layout-inert under ANY host layout (the base topbar
   and forked layouts like deveco's both wrap this component) — carried here,
   scoped, so a fork can't forget them and render the duplicates visibly. */
.cpub-nav-measure {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  height: 0;
  overflow: hidden;
  display: flex;
  gap: 2px;
  white-space: nowrap;
}
</style>
