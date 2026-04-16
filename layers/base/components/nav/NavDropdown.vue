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

function isChildVisible(child: NavItem, features: Record<string, boolean>): boolean {
  if (child.featureGate && !features[child.featureGate]) return false;
  return true;
}

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

const visibleChildren = computed(() =>
  (props.item.children ?? []).filter(c => isChildVisible(c, featureMap.value)),
);
</script>

<template>
  <div v-if="visibleChildren.length > 0" class="cpub-nav-dropdown">
    <button
      class="cpub-nav-link cpub-nav-trigger"
      :class="{ 'cpub-nav-trigger--open': open }"
      aria-haspopup="true"
      :aria-expanded="open"
      @click.stop="emit('toggle')"
    >
      <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
      <i class="fa-solid fa-chevron-down cpub-nav-caret" />
    </button>
    <div v-if="open" class="cpub-nav-panel">
      <template v-for="child in visibleChildren" :key="child.id">
        <span
          v-if="child.disabled"
          class="cpub-nav-panel-item cpub-nav-panel-item--disabled"
        >
          <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
        </span>
        <a
          v-else-if="child.type === 'external' && child.href"
          :href="child.href"
          target="_blank"
          rel="noopener"
          class="cpub-nav-panel-item"
          @click="emit('close')"
        >
          <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
          <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px; opacity: 0.5;"></i>
        </a>
        <NuxtLink
          v-else-if="child.route"
          :to="child.route"
          class="cpub-nav-panel-item"
          @click="emit('close')"
        >
          <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
        </NuxtLink>
      </template>
    </div>
  </div>
</template>
