<script setup lang="ts">
defineProps<{
  label: string;
  active?: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <button
    class="cpub-filter-chip"
    :class="{ active }"
    :aria-pressed="active"
    @click="$emit('toggle')"
  >
    {{ label }}
  </button>
</template>
