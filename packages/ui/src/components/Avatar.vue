<script setup lang="ts">
import { computed, ref } from 'vue';

defineOptions({ name: 'CpubAvatar', inheritAttrs: false });

interface Props {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
}

const props = withDefaults(defineProps<Props>(), {
  src: undefined,
  alt: '',
  size: 'md',
  fallback: '',
});

const imgError = ref(false);

const initials = computed(() => {
  if (props.fallback) {
    return props.fallback.slice(0, 2).toUpperCase();
  }
  if (props.alt) {
    return props.alt
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return '?';
});

const showImage = computed(() => props.src && !imgError.value);

function onImgError(): void {
  imgError.value = true;
}
</script>

<template>
  <span
    v-bind="$attrs"
    :class="['cpub-avatar', `cpub-avatar--${props.size}`]"
    role="img"
    :aria-label="props.alt || 'Avatar'"
  >
    <img
      v-if="showImage"
      :src="props.src"
      :alt="props.alt"
      class="cpub-avatar__img"
      @error="onImgError"
    />
    <span v-else class="cpub-avatar__fallback" aria-hidden="true">
      {{ initials }}
    </span>
  </span>
</template>

<style scoped>
.cpub-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: var(--border-width-default) solid var(--border);
  background-color: var(--surface2);
  overflow: hidden;
  flex-shrink: 0;
}

.cpub-avatar--xs { width: 20px; height: 20px; }
.cpub-avatar--sm { width: 28px; height: 28px; }
.cpub-avatar--md { width: 36px; height: 36px; }
.cpub-avatar--lg { width: 48px; height: 48px; }
.cpub-avatar--xl { width: 72px; height: 72px; }

.cpub-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-avatar__fallback {
  font-family: var(--font-mono);
  font-weight: var(--font-weight-semibold);
  color: var(--text-dim);
  line-height: 1;
  user-select: none;
}

.cpub-avatar--xs .cpub-avatar__fallback { font-size: 0.5rem; }
.cpub-avatar--sm .cpub-avatar__fallback { font-size: 0.625rem; }
.cpub-avatar--md .cpub-avatar__fallback { font-size: var(--text-xs); }
.cpub-avatar--lg .cpub-avatar__fallback { font-size: var(--text-sm); }
.cpub-avatar--xl .cpub-avatar__fallback { font-size: var(--text-lg); }
</style>
