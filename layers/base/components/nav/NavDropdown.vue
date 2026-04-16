<script setup lang="ts">
import type { NavItem } from '@commonpub/server';

const props = defineProps<{
  item: NavItem;
  open: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  close: [];
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

function isChildVisible(child: NavItem): boolean {
  if (child.featureGate && !featureMap.value[child.featureGate]) return false;
  if (child.visibleTo === 'authenticated' && !isAuthenticated.value) return false;
  if (child.visibleTo === 'admin' && !isAdmin.value) return false;
  return true;
}

const visibleChildren = computed(() =>
  (props.item.children ?? []).filter((c: NavItem) => isChildVisible(c)),
);

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) {
    emit('close');
  }
}
</script>

<template>
  <div v-if="visibleChildren.length > 0" class="cpub-nav-dropdown" @keydown="handleKeydown">
    <button
      class="cpub-nav-link cpub-nav-trigger"
      :class="{ 'cpub-nav-trigger--open': open }"
      :aria-label="`${item.label} menu`"
      aria-haspopup="true"
      :aria-expanded="open"
      @click.stop="emit('toggle')"
      @keydown.enter.stop="emit('toggle')"
      @keydown.space.prevent.stop="emit('toggle')"
    >
      <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
      <i class="fa-solid fa-chevron-down cpub-nav-caret" />
    </button>
    <div v-if="open" class="cpub-nav-panel" role="menu">
      <template v-for="child in visibleChildren" :key="child.id">
        <span
          v-if="child.disabled"
          class="cpub-nav-panel-item cpub-nav-panel-item--disabled"
          role="menuitem"
          aria-disabled="true"
        >
          <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
        </span>
        <a
          v-else-if="child.type === 'external' && child.href"
          :href="child.href"
          target="_blank"
          rel="noopener"
          class="cpub-nav-panel-item"
          role="menuitem"
          @click="emit('close')"
        >
          <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
          <i class="fa-solid fa-arrow-up-right-from-square cpub-nav-external-icon"></i>
        </a>
        <NuxtLink
          v-else-if="child.route"
          :to="child.route"
          class="cpub-nav-panel-item"
          role="menuitem"
          @click="emit('close')"
        >
          <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cpub-nav-external-icon {
  font-size: 8px;
  color: var(--text-faint);
  margin-left: 2px;
}
</style>
