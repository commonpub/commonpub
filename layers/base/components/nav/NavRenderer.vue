<script setup lang="ts">
import type { NavItem } from '@commonpub/server';

defineProps<{
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
</script>

<template>
  <nav class="cpub-topbar-nav" aria-label="Main navigation">
    <template v-for="item in items" :key="item.id">
      <NavDropdown
        v-if="item.type === 'dropdown' && isVisible(item)"
        :item="item"
        :open="openDropdown === item.id"
        @toggle="emit('toggle-dropdown', item.id)"
        @close="emit('close-dropdowns')"
      />
      <NavLink
        v-else-if="isVisible(item)"
        :item="item"
      />
    </template>
  </nav>
</template>
