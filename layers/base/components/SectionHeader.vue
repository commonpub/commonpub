<script setup lang="ts">
defineProps<{
  title: string;
  viewAllLink?: string;
  viewAllLabel?: string;
  large?: boolean;
}>();
</script>

<template>
  <div class="cpub-section-header">
    <h2 :class="large ? 'cpub-section-title-lg' : 'cpub-section-title'">{{ title }}</h2>
    <NuxtLink v-if="viewAllLink" :to="viewAllLink" class="cpub-view-all">
      {{ viewAllLabel || 'View all' }} <i class="fa-solid fa-arrow-right" style="font-size: 9px"></i>
    </NuxtLink>
  </div>
</template>
