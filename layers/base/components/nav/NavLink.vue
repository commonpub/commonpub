<script setup lang="ts">
import type { NavItem } from '@commonpub/server';

const props = defineProps<{
  item: NavItem;
}>();

const isExternal = computed(() => props.item.type === 'external' && props.item.href);
</script>

<template>
  <span v-if="item.disabled" class="cpub-nav-link cpub-nav-link--disabled">
    <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
  </span>
  <a
    v-else-if="isExternal"
    :href="item.href"
    target="_blank"
    rel="noopener"
    class="cpub-nav-link"
  >
    <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
    <i class="fa-solid fa-arrow-up-right-from-square cpub-nav-external-icon"></i>
  </a>
  <NuxtLink
    v-else-if="item.route"
    :to="item.route"
    class="cpub-nav-link"
  >
    <i v-if="item.icon" :class="item.icon"></i> {{ item.label }}
  </NuxtLink>
</template>

<style scoped>
.cpub-nav-external-icon {
  font-size: 8px;
  color: var(--text-faint);
  margin-left: 2px;
}
</style>
