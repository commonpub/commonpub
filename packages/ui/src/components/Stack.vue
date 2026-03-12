<script setup lang="ts">
defineOptions({ name: 'CpubStack' });

interface Props {
  direction?: 'row' | 'column';
  gap?: string;
  align?: string;
  justify?: string;
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'column',
  gap: 'var(--space-4)',
  align: 'stretch',
  justify: 'flex-start',
});
</script>

<template>
  <div
    v-bind="$attrs"
    class="cpub-stack"
    :style="{
      flexDirection: props.direction,
      gap: props.gap,
      alignItems: props.align,
      justifyContent: props.justify,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.cpub-stack {
  display: flex;
}
</style>
