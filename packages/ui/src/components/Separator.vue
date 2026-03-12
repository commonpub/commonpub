<script setup lang="ts">
defineOptions({ name: 'CpubSeparator' });

interface Props {
  orientation?: 'horizontal' | 'vertical';
  dashed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
  dashed: false,
});
</script>

<template>
  <hr
    v-bind="$attrs"
    :class="[
      'cpub-separator',
      `cpub-separator--${props.orientation}`,
      { 'cpub-separator--dashed': props.dashed },
    ]"
    :aria-orientation="props.orientation"
    role="separator"
  />
</template>

<style scoped>
.cpub-separator {
  border: none;
  margin: 0;
  flex-shrink: 0;
}

.cpub-separator--horizontal {
  width: 100%;
  height: 0;
  border-top: var(--border-width-thin) solid var(--border2);
}

.cpub-separator--vertical {
  height: 100%;
  width: 0;
  border-left: var(--border-width-thin) solid var(--border2);
  align-self: stretch;
}

.cpub-separator--dashed {
  border-style: dashed;
}
</style>
