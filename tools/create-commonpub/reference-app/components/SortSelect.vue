<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: Array<{ value: string; label: string }>;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <select
    class="cpub-select cpub-input-sm"
    :value="modelValue"
    aria-label="Sort by"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="opt in options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
</template>

<style scoped>
.cpub-select {
  width: auto;
  min-width: 120px;
}
</style>
