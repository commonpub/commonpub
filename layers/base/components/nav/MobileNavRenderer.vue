<script setup lang="ts">
import type { NavItem } from '@commonpub/server';

defineProps<{
  items: NavItem[];
}>();

const emit = defineEmits<{
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

function isVisible(item: NavItem): boolean {
  if (item.featureGate && !featureMap.value[item.featureGate]) return false;
  if (item.visibleTo === 'authenticated' && !isAuthenticated.value) return false;
  if (item.visibleTo === 'admin' && !isAdmin.value) return false;
  return true;
}

function visibleChildren(item: NavItem): NavItem[] {
  return (item.children ?? []).filter(c => isVisible(c));
}
</script>

<template>
  <nav class="cpub-mobile-nav" aria-label="Mobile navigation">
    <template v-for="item in items" :key="item.id">
      <!-- Dropdown → section label + indented children -->
      <template v-if="item.type === 'dropdown' && isVisible(item) && visibleChildren(item).length > 0">
        <div class="cpub-mobile-section-label">{{ item.label }}</div>
        <template v-for="child in visibleChildren(item)" :key="child.id">
          <span
            v-if="child.disabled"
            class="cpub-mobile-link cpub-mobile-link--indent cpub-mobile-link--disabled"
          >
            <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
          </span>
          <a
            v-else-if="child.type === 'external' && child.href"
            :href="child.href"
            target="_blank"
            rel="noopener"
            class="cpub-mobile-link cpub-mobile-link--indent"
            @click="emit('close')"
          >
            <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
          </a>
          <NuxtLink
            v-else-if="child.route"
            :to="child.route"
            class="cpub-mobile-link cpub-mobile-link--indent"
            @click="emit('close')"
          >
            <i v-if="child.icon" :class="child.icon"></i> {{ child.label }}
          </NuxtLink>
        </template>
      </template>

      <!-- Regular link -->
      <template v-else-if="isVisible(item) && item.type !== 'dropdown'">
        <a
          v-if="item.type === 'external' && item.href"
          :href="item.href"
          target="_blank"
          rel="noopener"
          class="cpub-mobile-link"
          @click="emit('close')"
        >
          <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
        </a>
        <NuxtLink
          v-else-if="item.route"
          :to="item.route"
          class="cpub-mobile-link"
          @click="emit('close')"
        >
          <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
        </NuxtLink>
      </template>
    </template>
  </nav>
</template>
